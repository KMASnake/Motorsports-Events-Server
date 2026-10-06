import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {pool} from '../lib/db.js';
import type {JsonObject} from './contracts.js';
import {failureClassification,httpFailureCategory,normalizeRetryAfter,type ProviderFailureClassification} from './providerFailure.js';
import {systemClock,type Clock} from './schedulerService.js';
import type {Jitter} from './quotaCadenceService.js';

const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,canonical(value)])):v;
export const acquisitionRetryKey=(input:{cursor:JsonObject;workClass:string;season:number;safeUnitKey:string})=>createHash('sha256').update(JSON.stringify(canonical({cursor:input.cursor,workClass:input.workClass,season:input.season,safeUnitKey:input.safeUnitKey}))).digest('hex');
export type RetryState='ready'|'retry_wait'|'quota_wait'|'paused'|'permanent_failure'|'auth_failure'|'exhausted'|'succeeded';
export const ACQUISITION_RETRY_POLICY={version:'acquisition_retry_v1',maxAttempts:5,transientMs:30000,rateLimitMs:60000,maxMs:3600000} as const;
const terminal=(state:string)=>['paused','permanent_failure','auth_failure','exhausted','succeeded'].includes(state);
export function retryDisposition(count:number,failure:ProviderFailureClassification|null,now:Date,quotaDeadline:Date|null,jitter:Jitter){
  let state:RetryState='succeeded',local:Date|null=null,next:Date|null=null;
  if(failure){
    if(count>=ACQUISITION_RETRY_POLICY.maxAttempts)state='exhausted';
    else if(failure.category==='CALLER_ABORTED'||['request_budget_exhausted','request_cancelled'].includes(failure.code))state='paused';
    else if(['HTTP_AUTHENTICATION','HTTP_AUTHORIZATION'].includes(failure.category))state='auth_failure';
    else if(['HTTP_RATE_LIMIT','HTTP_TRANSIENT','NETWORK_TRANSIENT','TIMEOUT'].includes(failure.category)){
      state='retry_wait';const base=failure.category==='HTTP_RATE_LIMIT'?60000:30000;
      const delay=Math.min(3600000,base*2**Math.max(0,count-1));
      const extra=jitter(Math.min(10000,3600000-delay));
      if(!Number.isFinite(extra)||extra<0||extra>Math.min(10000,3600000-delay))throw new Error('retry_jitter_invalid');
      local=new Date(now.getTime()+delay+extra);
      const retryAfter=failure.retryAfterState==='valid'&&failure.retryAfterAt?Date.parse(failure.retryAfterAt):0;
      next=new Date(Math.max(local.getTime(),Number.isFinite(retryAfter)?retryAfter:0,quotaDeadline?.getTime()??0));
    }else state='permanent_failure';
  }
  return {state,local,next};
}

export class AcquisitionRetryService{
  constructor(readonly clock:Clock=systemClock,readonly jitter:Jitter=max=>Math.floor(Math.random()*(max+1))){}
  async ensure(client:PoolClient,input:{providerId:string;streamId:string;traversalId:string;cursor:JsonObject;workClass:string;season:number;safeUnitKey:string}){
    const key=acquisitionRetryKey(input);
    const result=await client.query(`insert into provider_acquisition_retry_units(id,provider_instance_id,stream_id,traversal_id,logical_unit_key,created_at,updated_at)
      select $1,$2,s.id,t.id,$5,$6,$6 from sync_streams s join provider_championships pc on pc.id=s.provider_championship_id
      join provider_acquisition_traversals t on t.stream_id=s.id and t.id=$4 where s.id=$3 and pc.provider_instance_id=$2
      on conflict(traversal_id,logical_unit_key) do update set logical_unit_key=excluded.logical_unit_key returning id`,[randomUUID(),input.providerId,input.streamId,input.traversalId,key,this.clock.now()]);
    if(!result.rows[0])throw new Error('retry_unit_association_invalid');return String(result.rows[0].id);
  }
  async load(id:string){return (await pool.query('select * from provider_acquisition_retry_units where id=$1',[id])).rows[0]??null;}
  async admission(client:PoolClient,id:string,providerId:string,streamId:string|null){
    const unit=(await client.query('select * from provider_acquisition_retry_units where id=$1 for update',[id])).rows[0];
    if(!unit||unit.provider_instance_id!==providerId||unit.stream_id!==streamId)throw new Error('retry_unit_association_invalid');
    if(terminal(unit.state))return 'acquisition_retry_'+unit.state;
    if(unit.next_retry_at&&new Date(unit.next_retry_at)>this.clock.now())return 'acquisition_retry_not_due';
    const pending=Number((await client.query(`select count(*) n from provider_acquisition_retry_charges r join provider_request_charges c on c.id=r.charge_id where r.retry_unit_id=$1 and c.emitted is null`,[id])).rows[0].n);
    if(Number(unit.emitted_attempt_count)+pending>=Number(unit.max_emitted_attempts))return 'acquisition_retry_budget_reserved';
    return null;
  }
  async quotaWait(client:PoolClient,id:string,deadline:Date|null,reason:string){
    await client.query(`update provider_acquisition_retry_units set state=$4,quota_deadline=$2,next_retry_at=case when $4='paused' or $2::timestamptz is null then null else greatest(next_retry_at,$2) end,updated_at=$3 where id=$1 and state not in ('paused','permanent_failure','auth_failure','exhausted','succeeded')`,[id,deadline,this.clock.now(),reason==='provider_unavailable'?'paused':'quota_wait']);
  }
  async recordCharge(client:PoolClient,chargeId:string,input:{errorCode?:string;status?:number;headers?:Readonly<Record<string,string|undefined>>;classification?:ProviderFailureClassification;quotaDeadline?:Date|null;quotaIndefinite?:boolean}){
    const link=(await client.query(`select r.retry_unit_id from provider_acquisition_retry_charges r where charge_id=$1`,[chargeId])).rows[0];if(!link)return;
    const unit=(await client.query('select * from provider_acquisition_retry_units where id=$1 for update',[link.retry_unit_id])).rows[0];
    const charge=(await client.query('select emitted from provider_request_charges where id=$1',[chargeId])).rows[0];
    if(charge?.emitted!==true)return;
    const counted=await client.query("update provider_acquisition_retry_charges set counted=true,emission_disposition='confirmed_emitted' where charge_id=$1 and counted=false returning charge_id",[chargeId]);if(!counted.rowCount)return;
    const count=Number(unit.emitted_attempt_count)+1;
    if(count>Number(unit.max_emitted_attempts))throw new Error('retry_attempt_budget_exceeded');
    const now=this.clock.now();
    const failure=input.classification??(input.errorCode?failureClassification(input.errorCode,{httpStatus:input.status??null}):input.status!==undefined&&(input.status<200||input.status>=300)?failureClassification(`http_${input.status}`,{category:httpFailureCategory(input.status),httpStatus:input.status,...normalizeRetryAfter(input.headers?.['retry-after'],now)}):null);
    await client.query('update provider_acquisition_retry_units set emitted_attempt_count=$2,last_charge_id=$3 where id=$1',[unit.id,count,chargeId]);
    if(terminal(unit.state)){await client.query("update provider_acquisition_retry_units set state=case when state<>'succeeded' and $3=5 then 'exhausted' else state end,updated_at=$2 where id=$1",[unit.id,now,count]);return;}
    await this.transition(client,unit.id,count,failure,input.quotaDeadline);
    if(input.quotaIndefinite&&failure)await client.query("update provider_acquisition_retry_units set state='quota_wait',next_retry_at=null where id=$1 and state='retry_wait'",[unit.id]);
    if(!failure)await client.query("update provider_acquisition_retry_units set state='ready' where id=$1",[unit.id]);
  }
  async transition(client:PoolClient,id:string,count:number,failure:ProviderFailureClassification|null,additionalQuotaDeadline:Date|null=null){
    const protectedUnit=(await client.query('select state from provider_acquisition_retry_units where id=$1 for update',[id])).rows[0];
    if(protectedUnit?.state==='succeeded')return;
    const now=this.clock.now();
    const row=(await client.query(`select greatest(r.provider_backoff_until,r.next_eligible_at,s.stream_backoff_until,u.quota_deadline) deadline from provider_acquisition_retry_units u join sync_streams s on s.id=u.stream_id left join provider_quota_runtime r on r.provider_instance_id=u.provider_instance_id where u.id=$1`,[id])).rows[0];
    const existing=row?.deadline?new Date(row.deadline):null;
    const quotaDeadline=additionalQuotaDeadline&&(!existing||additionalQuotaDeadline>existing)?additionalQuotaDeadline:existing;
    const disposition=retryDisposition(count,failure,now,quotaDeadline,this.jitter);
    await client.query(`update provider_acquisition_retry_units set state=$2,next_retry_at=$3,local_backoff_until=$4,quota_deadline=$5,failure_category=$6,failure_code=$7,http_status=$8,retry_after_state=$9,retry_after_at=$10,updated_at=$11 where id=$1`,[id,disposition.state,disposition.next,disposition.local,quotaDeadline,failure?.category??null,failure?.code??null,failure?.httpStatus??null,failure?.retryAfterState??null,failure?.retryAfterState==='valid'?failure.retryAfterAt:null,now]);
  }
  async completeUnit(client:PoolClient,id:string){
    await client.query('select id from provider_acquisition_retry_units where id=$1 for update',[id]);
    await client.query("update provider_acquisition_retry_units set state='succeeded',next_retry_at=null,updated_at=$2 where id=$1 and state='ready'",[id,this.clock.now()]);
  }
  // Called in the acquisition outcome transaction for local/adapter failures.
  // HTTP callbacks have already persisted authoritative charge outcomes atomically.
  async recordUnitFailure(client:PoolClient,id:string,failure:ProviderFailureClassification){
    const unit=(await client.query('select * from provider_acquisition_retry_units where id=$1 for update',[id])).rows[0];if(!unit)return;
    if(terminal(unit.state))return;
    if(unit.state==='retry_wait'||unit.state==='quota_wait'||failure.code==='quota_deferred')return;
    await this.transition(client,id,Number(unit.emitted_attempt_count),failure);
  }
}
