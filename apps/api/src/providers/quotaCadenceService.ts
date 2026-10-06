import {AcquisitionRetryService} from './acquisitionRetryService.js';
import {failureClassification,type ProviderFailureClassification} from './providerFailure.js';
import { randomUUID } from 'node:crypto';
import { pool } from '../lib/db.js';
import type { ProviderResponseMetadata, QuotaObservation } from './contracts.js';
import { systemClock, type Clock, type WorkClass } from './schedulerService.js';

export type QuotaWorkClass=WorkClass|'manual_discovery'|'periodic_discovery'|'connection_test';
export type Jitter=(maximumMs:number)=>number;
export type QuotaDecision={allowed:boolean;chargeId?:string;next_eligible_at:string|null;blocking_reason:string|null;quota_snapshot:Record<string,unknown>};
const defaultJitter:Jitter=max=>Math.floor(Math.random()*Math.max(1,max));

function zonedParts(date:Date,timeZone:string){
  try{return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)])) as Record<string,number>;}catch{return zonedParts(date,'UTC');}
}
function windowStart(date:Date,kind:'minute'|'hour'|'day'|'month',timeZone:string){
  const p=zonedParts(date,timeZone);if(kind==='month'){p.day=1;p.hour=0;p.minute=0;}if(kind==='day'){p.hour=0;p.minute=0;}if(kind==='hour')p.minute=0;
  let guess=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);for(let i=0;i<3;i++){const actual=zonedParts(new Date(guess),timeZone);const wanted=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute),got=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute);guess+=wanted-got;}return new Date(guess);
}
const addWindow=(start:Date,kind:string)=>{const d=new Date(start);if(kind==='minute')d.setUTCMinutes(d.getUTCMinutes()+1);else if(kind==='hour')d.setUTCHours(d.getUTCHours()+1);else if(kind==='day')d.setUTCDate(d.getUTCDate()+1);else d.setUTCMonth(d.getUTCMonth()+1);return d;};
const usable=(limit:number,safety:number)=>Math.max(0,Math.floor(limit*(1-safety/100)));
export function pacingDelayMs(remaining:number,resetAt:Date,now:Date,workClass:QuotaWorkClass,burst=1){if(workClass==='current'||remaining<=0)return 0;return Math.max(0,Math.ceil((resetAt.getTime()-now.getTime())/Math.max(1,remaining)*Math.max(1,burst)));}
export function classifyProviderFailure(code:string,status?:number):'provider'|'stream'{if(['invalid_json','invalid_content_type','response_too_large','normalization_error'].includes(code))return 'stream';if(status===401||status===403||status===429||status===undefined||status>=500)return 'provider';return 'stream';}

export class QuotaCadenceService{
  constructor(readonly clock:Clock=systemClock,readonly jitter:Jitter=defaultJitter){}
  async authorize(providerId:string,workClass:QuotaWorkClass,streamId:string|null=null,retryUnitId:string|null=null):Promise<QuotaDecision>{
    const client=await pool.connect();try{await client.query('begin');
      await client.query(`insert into provider_quota_runtime(provider_instance_id) values($1) on conflict do nothing`,[providerId]);
      const provider=(await client.query(`select p.enabled,p.state,coalesce(q.minimum_interval_seconds,1) minimum_interval_seconds,
        coalesce(q.safety_margin_percent,5)::float8 safety_margin_percent,coalesce(q.current_reserve_mode,'percent') current_reserve_mode,
        coalesce(q.current_reserve_value,20) current_reserve_value,coalesce(q.provider_timezone,'UTC') provider_timezone,
        q.minute_limit,q.hourly_limit,q.daily_limit,q.monthly_limit,r.*
        from provider_instances p left join provider_quota_policies q on q.provider_instance_id=p.id
        join provider_quota_runtime r on r.provider_instance_id=p.id where p.id=$1 for update of r`,[providerId])).rows[0];
      if(!provider){await client.query('rollback');return {allowed:false,next_eligible_at:null,blocking_reason:'provider_not_found',quota_snapshot:{}};}
      const retry=new AcquisitionRetryService(this.clock,this.jitter);
      if(retryUnitId){const refusal=await retry.admission(client,retryUnitId,providerId,streamId);if(refusal){await client.query('commit');return {allowed:false,next_eligible_at:null,blocking_reason:refusal,quota_snapshot:{}};}}
      const now=this.clock.now(), snapshot:Record<string,unknown>={known_limits:{},consumed:{},work_class:workClass};
      const block=async(reason:string,next:Date|null)=>{if(retryUnitId)await retry.quotaWait(client,retryUnitId,next,reason);await client.query('update provider_quota_runtime set last_blocking_reason=$2,next_eligible_at=$3,updated_at=$4 where provider_instance_id=$1',[providerId,reason,next,now]);await client.query('commit');return {allowed:false,next_eligible_at:next?.toISOString()??null,blocking_reason:reason,quota_snapshot:snapshot};};
      if(!provider.enabled||provider.state!=='active')return await block('provider_unavailable',null);
      const blockers:{reason:string;next:Date|null}[]=[];
      if(provider.provider_backoff_until&&new Date(provider.provider_backoff_until)>now)blockers.push({reason:'provider_backoff',next:new Date(provider.provider_backoff_until)});
      if(streamId){const stream=(await client.query('select stream_backoff_until from sync_streams where id=$1',[streamId])).rows[0];if(stream?.stream_backoff_until&&new Date(stream.stream_backoff_until)>now)blockers.push({reason:'stream_backoff',next:new Date(stream.stream_backoff_until)});}
      if(provider.last_request_at){const next=new Date(new Date(provider.last_request_at).getTime()+Number(provider.minimum_interval_seconds)*1000);if(next>now)blockers.push({reason:'minimum_interval',next});}
      const sources:Record<string,string>={};
      for(const [kind,column] of [['minute','minute_limit'],['hour','hourly_limit'],['day','daily_limit'],['month','monthly_limit']] as const){
        const observed=(await client.query(`select limit_value,remaining,resets_at,reliable,observed_at,charge_sequence from provider_quota_observations where provider_instance_id=$1 and window_kind=$2 and reliable and (resets_at is null or resets_at>$3) order by observed_at desc limit 1`,[providerId,kind,now])).rows[0];const configured=provider[column]==null?null:Number(provider[column]);const limit=observed?.limit_value==null?configured:configured===null?Number(observed.limit_value):Math.min(configured,Number(observed.limit_value));(snapshot.known_limits as Record<string,unknown>)[kind]=limit;sources[kind]=observed&&configured!==null?'mixed':observed?'provider_headers':configured!==null?'local_counter':'unknown';if(limit===null&&observed?.remaining==null)continue;
        const start=windowStart(now,kind,provider.provider_timezone);const count=Number((await client.query(`select consumed from provider_quota_windows where provider_instance_id=$1 and window_kind=$2 and window_started_at=$3`,[providerId,kind,start])).rows[0]?.consumed??0);(snapshot.consumed as Record<string,unknown>)[kind]=count;
        let ceiling=limit===null?Number.POSITIVE_INFINITY:usable(limit,Number(provider.safety_margin_percent));
        if(kind==='month'&&workClass!=='current'){const reserve=provider.current_reserve_mode==='absolute'?Number(provider.current_reserve_value):Math.ceil(ceiling*Number(provider.current_reserve_value)/100);ceiling=Math.max(0,ceiling-reserve);}
        const localRemaining=ceiling-count;
        let providerRemaining:number|null=null;
        if(observed?.remaining!==null&&observed?.remaining!==undefined){const sinceObservation=Number((await client.query(`select count(*) count from provider_request_charges where provider_instance_id=$1 and emitted is distinct from false and (case when $2::bigint is null then charged_at>$3 else charge_sequence>$2 end)`,[providerId,observed.charge_sequence??null,observed.observed_at])).rows[0].count);providerRemaining=Math.max(0,Number(observed.remaining)-sinceObservation);}
        const effectiveRemaining=providerRemaining===null?localRemaining:Math.min(localRemaining,providerRemaining);((snapshot as any).remaining_by_window??={})[kind]={local:Number.isFinite(localRemaining)?Math.max(0,localRemaining):null,provider:providerRemaining,effective:Number.isFinite(effectiveRemaining)?Math.max(0,effectiveRemaining):providerRemaining,source:sources[kind]};
        if(providerRemaining!==null&&providerRemaining<=0)blockers.push({reason:'provider_reported_exhausted',next:observed.resets_at?new Date(observed.resets_at):null});
        if(kind==='month'&&(workClass==='recent_catchup'||workClass==='deep_history')&&provider.last_request_at&&effectiveRemaining>0&&Number.isFinite(effectiveRemaining)){const reset=addWindow(start,kind),delay=pacingDelayMs(effectiveRemaining,reset,now,workClass);(snapshot as any).pacing_delay_ms=delay;const next=new Date(new Date(provider.last_request_at).getTime()+delay);if(next>now)blockers.push({reason:'dynamic_pacing',next});}
        if(count>=ceiling)blockers.push({reason:kind==='month'&&workClass!=='current'?'current_reserve':'quota_'+kind,next:addWindow(start,kind)});
      }
      (snapshot as any).sources=sources;(snapshot as any).source=Object.values(sources).every(value=>value==='local_counter'||value==='unknown')?'local_counter':Object.values(sources).every(value=>value==='provider_headers'||value==='unknown')?'provider_headers':'mixed';
      if(blockers.length){const selected=blockers.reduce((best,item)=>best.next===null?best:item.next===null?item:item.next>best.next?item:best);return await block(selected.reason,selected.next);}
      const chargeId=randomUUID();for(const kind of ['minute','hour','day','month'] as const){const start=windowStart(now,kind,provider.provider_timezone);await client.query(`insert into provider_quota_windows(provider_instance_id,window_kind,window_started_at,consumed) values($1,$2,$3,1) on conflict(provider_instance_id,window_kind,window_started_at) do update set consumed=provider_quota_windows.consumed+1,updated_at=$3`,[providerId,kind,start]);}
      await client.query(`insert into provider_request_charges(id,provider_instance_id,stream_id,work_class,charged_at) values($1,$2,$3,$4,$5)`,[chargeId,providerId,streamId,workClass,now]);
      if(retryUnitId)await client.query('insert into provider_acquisition_retry_charges(charge_id,retry_unit_id) values($1,$2)',[chargeId,retryUnitId]);
      await client.query(`update provider_quota_runtime set last_request_at=$2,last_blocking_reason=null,next_eligible_at=null,updated_at=$2 where provider_instance_id=$1`,[providerId,now]);await client.query('commit');return {allowed:true,chargeId,next_eligible_at:null,blocking_reason:null,quota_snapshot:snapshot};
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }
  private async refundNotEmitted(client:import('pg').PoolClient,chargeId:string){
    const charge=(await client.query(`update provider_request_charges set emitted=false,outcome='not_emitted' where id=$1 and emitted is null returning *`,[chargeId])).rows[0];
    if(!charge)return;
    await client.query("update provider_acquisition_retry_charges set emission_disposition='confirmed_not_emitted' where charge_id=$1",[chargeId]);
    const timezone=(await client.query(`select coalesce(provider_timezone,'UTC') timezone from provider_quota_policies where provider_instance_id=$1`,[charge.provider_instance_id])).rows[0]?.timezone??'UTC';
    for(const kind of ['minute','hour','day','month'] as const){const start=windowStart(new Date(charge.charged_at),kind,timezone);await client.query(`update provider_quota_windows set consumed=greatest(0,consumed-1),updated_at=now() where provider_instance_id=$1 and window_kind=$2 and window_started_at=$3`,[charge.provider_instance_id,kind,start]);}
    await client.query(`update provider_quota_runtime set last_request_at=(select max(charged_at) from provider_request_charges where provider_instance_id=$1 and emitted is distinct from false),updated_at=now() where provider_instance_id=$1`,[charge.provider_instance_id]);
  }
  async markNotEmitted(chargeId:string){const client=await pool.connect();try{await client.query('begin');await client.query(`select q.provider_instance_id from provider_quota_runtime q join provider_request_charges c on c.provider_instance_id=q.provider_instance_id join provider_acquisition_retry_charges r on r.charge_id=c.id where c.id=$1 for update of q`,[chargeId]);await this.refundNotEmitted(client,chargeId);await client.query('commit');}catch(e){await client.query('rollback');throw e;}finally{client.release();}}
  // Offline evidence disposition only. No stale detection, provider I/O or retry execution.
  async resolveIndeterminateEmission(input:{chargeId:string;disposition:'confirmed_not_emitted'|'confirmed_emitted';evidenceReference:string}){
    if(!['confirmed_not_emitted','confirmed_emitted'].includes(input.disposition)||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(input.evidenceReference))throw new Error('emission_disposition_evidence_invalid');
    const client=await pool.connect();try{await client.query('begin');
      await client.query(`select q.provider_instance_id from provider_quota_runtime q join provider_request_charges c on c.provider_instance_id=q.provider_instance_id join provider_acquisition_retry_charges r on r.charge_id=c.id where c.id=$1 for update of q`,[input.chargeId]);
      const charge=(await client.query(`select c.emitted,r.emission_disposition from provider_request_charges c join provider_acquisition_retry_charges r on r.charge_id=c.id where c.id=$1 for update of c,r`,[input.chargeId])).rows[0];
      if(!charge)throw new Error('emission_disposition_charge_not_found');
      if(charge.emitted!==null){
        if(charge.emission_disposition!==input.disposition)throw new Error('emission_disposition_conflict');
        await client.query('commit');return;
      }
      if(input.disposition==='confirmed_not_emitted')await this.refundNotEmitted(client,input.chargeId);
      else{
        await client.query("update provider_request_charges set emitted=true,outcome='emission_confirmed_outcome_unknown' where id=$1 and emitted is null",[input.chargeId]);
        // Confirmation of emission is not proof of provider success/failure. Require operator action.
        await new AcquisitionRetryService(this.clock,this.jitter).recordCharge(client,input.chargeId,{classification:failureClassification('emission_confirmed_outcome_unknown')});
      }
      await client.query('update provider_acquisition_retry_charges set disposition_evidence_reference=$2,disposed_at=$3 where charge_id=$1',[input.chargeId,input.evidenceReference,this.clock.now()]);
      await client.query('commit');
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  }
  async recordOutcome(chargeId:string,input:{metadata?:ProviderResponseMetadata;observation?:QuotaObservation|readonly QuotaObservation[]|null;errorCode?:string;classification?:ProviderFailureClassification;streamId?:string|null}){const now=this.clock.now();const client=await pool.connect();try{await client.query('begin');
      // Retry-bound operations take the existing quota runtime lock before the unit lock.
      const retryBound=await client.query(`select q.provider_instance_id from provider_quota_runtime q join provider_request_charges c on c.provider_instance_id=q.provider_instance_id join provider_acquisition_retry_charges r on r.charge_id=c.id where c.id=$1 for update of q`,[chargeId]);
      const charge=(await client.query(`update provider_request_charges set emitted=true,outcome=$2 where id=$1 and emitted is null returning *`,[chargeId,input.errorCode??String(input.metadata?.status??'success')])).rows[0];if(!charge){await client.query('commit');return;}
      // Caller cancellation is a charged local control-flow outcome, never a health failure.
      // Keep the emitted charge above; do not reset or penalize existing health/backoff state.
      if(input.errorCode==='aborted'){await new AcquisitionRetryService(this.clock,this.jitter).recordCharge(client,chargeId,{errorCode:input.errorCode,status:input.metadata?.status,classification:input.classification});await client.query('commit');return;}
      const observations=input.observation?(Array.isArray(input.observation)?input.observation:[input.observation]):[];for(const observation of observations){await client.query(`insert into provider_quota_observations(provider_instance_id,observed_at,window_kind,limit_value,remaining,resets_at,reliable,charge_sequence) values($1,$2,$3,$4,$5,$6,$7,$8)`,[charge.provider_instance_id,now,observation.windowKind,observation.limit,observation.remaining,observation.resetsAt,observation.reliable,charge.charge_sequence]);}
      const status=input.metadata?.status,error=input.errorCode??'';
      if(!input.errorCode&&status!==undefined&&status<400){await client.query(`update provider_quota_runtime set provider_backoff_until=null,provider_failure_count=0,updated_at=$2 where provider_instance_id=$1`,[charge.provider_instance_id,now]);if(input.streamId)await client.query(`update sync_streams set stream_backoff_until=null,stream_failure_count=0,updated_at=$2 where id=$1`,[input.streamId,now]);}
      else if(status===401||status===403){await client.query(`update provider_instances set state='suspended',updated_at=$2 where id=$1`,[charge.provider_instance_id,now]);}
      if(status===429){const runtime=(await client.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1 for update',[charge.provider_instance_id])).rows[0];const steps=[60000,300000,900000,3600000],delay=steps[Math.min(Number(runtime.provider_failure_count),3)]+this.jitter(15000);let until=new Date(now.getTime()+delay);const retry=input.metadata?.headers['retry-after'];if(retry){const seconds=Number(retry),parsed=Number.isFinite(seconds)?new Date(now.getTime()+seconds*1000):new Date(retry);if(!Number.isNaN(parsed.getTime())&&parsed>now)until=parsed;}await client.query(`update provider_quota_runtime set provider_backoff_until=$2,provider_failure_count=provider_failure_count+1,updated_at=$3 where provider_instance_id=$1`,[charge.provider_instance_id,until,now]);}
      else if(error==='timeout'||error==='network_error'||(status!==undefined&&status>=500)){const delay=Math.min(3600000,30000*2**Math.min(6,Number((await client.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1',[charge.provider_instance_id])).rows[0].provider_failure_count)))+this.jitter(10000);await client.query(`update provider_quota_runtime set provider_backoff_until=$2,provider_failure_count=provider_failure_count+1,updated_at=$3 where provider_instance_id=$1`,[charge.provider_instance_id,new Date(now.getTime()+delay),now]);}
      else if((input.errorCode||status===undefined||status>=400)&&classifyProviderFailure(error,status)==='stream'&&input.streamId)await client.query(`update sync_streams set stream_backoff_until=$2,stream_failure_count=stream_failure_count+1,last_error_code=$3,updated_at=$4 where id=$1`,[input.streamId,new Date(now.getTime()+300000+this.jitter(10000)),error||`http_${status}`,now]);
      await new AcquisitionRetryService(this.clock,this.jitter).recordCharge(client,chargeId,{errorCode:input.errorCode,status,headers:input.metadata?.headers,classification:input.classification,...(retryBound.rowCount?await this.retryQuotaDeadline(client,charge.provider_instance_id,charge.work_class):{})});
      await client.query('commit');}catch(e){await client.query('rollback');throw e;}finally{client.release();}}
  // Read-only deadline projection of the sovereign quota windows/observations.
  private async retryQuotaDeadline(client:import('pg').PoolClient,providerId:string,workClass:QuotaWorkClass){
    const now=this.clock.now();const policy=(await client.query('select * from provider_quota_policies where provider_instance_id=$1',[providerId])).rows[0];
    const deadlines:number[]=[];let quotaIndefinite=false;
    const runtime=(await client.query('select last_request_at from provider_quota_runtime where provider_instance_id=$1',[providerId])).rows[0];
    if(runtime?.last_request_at)deadlines.push(new Date(runtime.last_request_at).getTime()+Number(policy?.minimum_interval_seconds??1)*1000);
    for(const [kind,column] of [['minute','minute_limit'],['hour','hourly_limit'],['day','daily_limit'],['month','monthly_limit']] as const){
      const start=windowStart(now,kind,policy?.provider_timezone??'UTC');
      const count=Number((await client.query('select consumed from provider_quota_windows where provider_instance_id=$1 and window_kind=$2 and window_started_at=$3',[providerId,kind,start])).rows[0]?.consumed??0);
      const observation=(await client.query(`select * from provider_quota_observations where provider_instance_id=$1 and window_kind=$2 and reliable and (resets_at is null or resets_at>$3) order by observed_at desc limit 1`,[providerId,kind,now])).rows[0];
      const configured=policy?.[column]==null?null:Number(policy[column]);
      const limit=observation?.limit_value==null?configured:configured===null?Number(observation.limit_value):Math.min(configured,Number(observation.limit_value));
      if(limit!==null){let ceiling=usable(limit,Number(policy?.safety_margin_percent??5));if(kind==='month'&&workClass!=='current')ceiling=Math.max(0,ceiling-(policy?.current_reserve_mode==='absolute'?Number(policy.current_reserve_value):Math.ceil(ceiling*Number(policy?.current_reserve_value??20)/100)));if(count>=ceiling)deadlines.push(addWindow(start,kind).getTime());}
      if(observation?.remaining!=null){const consumed=Number((await client.query(`select count(*) n from provider_request_charges where provider_instance_id=$1 and emitted is distinct from false and (case when $2::bigint is null then charged_at>$3 else charge_sequence>$2 end)`,[providerId,observation.charge_sequence??null,observation.observed_at])).rows[0].n);if(Number(observation.remaining)-consumed<=0){if(observation.resets_at)deadlines.push(new Date(observation.resets_at).getTime());else quotaIndefinite=true;}}
    }
    return {quotaDeadline:deadlines.length?new Date(Math.max(...deadlines)):null,quotaIndefinite};
  }
  async diagnostics(providerId:string){const [policyResult,runtime,windows,observations]=await Promise.all([pool.query('select * from provider_quota_policies where provider_instance_id=$1',[providerId]),pool.query('select * from provider_quota_runtime where provider_instance_id=$1',[providerId]),pool.query('select * from provider_quota_windows where provider_instance_id=$1 order by window_started_at desc',[providerId]),pool.query('select * from provider_quota_observations where provider_instance_id=$1 order by observed_at desc limit 20',[providerId])]);const policy=policyResult.rows[0]??null,month=windows.rows.find(row=>row.window_kind==='month'),limit:number|null=policy?.monthly_limit==null?null:Number(policy.monthly_limit),ceiling:number|null=limit===null?null:usable(limit,Number(policy.safety_margin_percent)),reserve:number|null=ceiling===null?null:policy.current_reserve_mode==='absolute'?Number(policy.current_reserve_value):Math.ceil(ceiling*Number(policy.current_reserve_value)/100),usage=Number(month?.consumed??0),normalBudget=ceiling===null||reserve===null?null:ceiling-reserve,ratio=ceiling?usage/ceiling:null,state=ceiling===null?'quota_unknown':usage>=ceiling?'exhausted':normalBudget!==null&&usage>=normalBudget?'protected':ratio!==null&&ratio>=.95?'critical':ratio!==null&&ratio>=.8?'warning':'normal';return {policy,runtime:runtime.rows[0]??null,windows:windows.rows,observations:observations.rows,summary:{limit,operational_ceiling:ceiling,current_reserve:reserve,normal_budget:normalBudget,usage,remaining_estimated:ceiling===null?null:Math.max(0,ceiling-usage),distance_before_reserve:normalBudget===null?null:Math.max(0,normalBudget-usage),source:observations.rows.length&&policy?'mixed':observations.rows.length?'provider_headers':policy?'local_counter':'unknown',state,next_eligible_at:runtime.rows[0]?.next_eligible_at??null,blocking_reason:runtime.rows[0]?.last_blocking_reason??null}};}
}
