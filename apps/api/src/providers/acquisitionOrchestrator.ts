import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db.js';
import type { AcquiredProviderSourceItem,FetchWorkUnitInput,JsonObject,ProviderAdapter } from './contracts.js';
import { AcquisitionTransactionService } from './acquisitionTransactionService.js';
import type { Clock } from './schedulerService.js';
import { PersistentSchedulerService,systemClock } from './schedulerService.js';

export type AcquisitionWorkClass='finalization'|'current_hot'|'recent_catchup'|'deep_history';
export type TraversalOutcome={complete:boolean;emptyConfirmed:boolean;receivedItems:number};

export const currentPrioritySequence:readonly AcquisitionWorkClass[]=['finalization','current_hot','finalization','current_hot'];
const finalStatuses=['completed','finished','final'];

function civilParts(value:Date,timeZone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);return Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)])) as Record<string,number>;}
function zonedInstant(year:number,month:number,day:number,timeZone:string){const target=Date.UTC(year,month-1,day);let instant=target;for(let attempt=0;attempt<4;attempt+=1){const parts=civilParts(new Date(instant),timeZone);const represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);instant+=target-represented;}return new Date(instant);}
export function civilDayEndUtc(value:Date,timeZone='UTC'){const parts=civilParts(value,timeZone);const next=new Date(Date.UTC(parts.year,parts.month-1,parts.day+1));return new Date(zonedInstant(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate(),timeZone).getTime()-1);}

export function classifyCurrentInstant(value:Date,now:Date,hotDays:number,timeZone='UTC'):'past'|'current_hot'|'current_future'{
  const parts=civilParts(now,timeZone);
  const today=zonedInstant(parts.year,parts.month,parts.day,timeZone).getTime();
  const instant=value.getTime();
  if(instant<today)return 'past';
  const endDate=new Date(Date.UTC(parts.year,parts.month-1,parts.day+hotDays+1));
  const hotEnd=zonedInstant(endDate.getUTCFullYear(),endDate.getUTCMonth()+1,endDate.getUTCDate(),timeZone);
  return instant<hotEnd.getTime()?'current_hot':'current_future';
}

export function nextBootstrapWork(state:{bootstrap_state:string;recent_catchup_state:string;deep_history_state:string;current_stage:string},counter=0,phase:'current'|'historical'='current'):AcquisitionWorkClass|null{
  if(phase==='current')return currentPrioritySequence[counter%currentPrioritySequence.length]==='finalization'?'finalization':'current_hot';
  if(state.bootstrap_state==='pending'||state.bootstrap_state==='current')return null;
  if(state.bootstrap_state==='recent_catchup'&&state.recent_catchup_state!=='complete'&&state.recent_catchup_state!=='disabled')return 'recent_catchup';
  if(state.bootstrap_state==='deep_history'&&state.deep_history_state!=='complete'&&state.deep_history_state!=='disabled')return 'deep_history';
  return null;
}

export function advanceDeepHistory(input:{season:number;consecutiveEmpty:number;emptyLimit:number;historyFromSeason:number|null;mode:'all'|'from_season'|'none';outcome:TraversalOutcome}){
  if(!input.outcome.complete)return {season:input.season,consecutiveEmpty:input.consecutiveEmpty,complete:false,changed:false};
  const empty=input.outcome.emptyConfirmed&&input.outcome.receivedItems===0;
  const consecutiveEmpty=empty?input.consecutiveEmpty+1:0;
  const nextSeason=input.season-1;
  const bounded=input.mode==='none'||(input.mode==='from_season'&&input.historyFromSeason!==null&&nextSeason<input.historyFromSeason);
  return {season:nextSeason,consecutiveEmpty,complete:bounded||consecutiveEmpty>=input.emptyLimit,changed:true};
}

export type EndEstimate={end:Date;estimated:boolean;provenance:'provider'|'last_known_session'|'provider_peer_duration'|'adapter_rule'|'civil_day_fallback'};
const validDuration=(value:number)=>Number.isFinite(value)&&value>=0;
export function estimateTheoreticalEnd(input:{start:Date;providerEnd?:Date|null;sessionEnds?:readonly Date[];comparableDurationsMs?:readonly number[];adapterDurationMs?:number|null;civilDayEnd?:Date|null}):EndEstimate{
  if(input.providerEnd)return {end:input.providerEnd,estimated:false,provenance:'provider'};
  const sessionEnds=(input.sessionEnds??[]).filter(value=>value>=input.start).sort((a,b)=>a.getTime()-b.getTime());
  if(sessionEnds.length)return {end:sessionEnds.at(-1)!,estimated:true,provenance:'last_known_session'};
  const durations=(input.comparableDurationsMs??[]).filter(validDuration).sort((a,b)=>a-b);
  if(durations.length>=3){const middle=Math.floor(durations.length/2),median=durations.length%2?durations[middle]:(durations[middle-1]+durations[middle])/2;return {end:new Date(input.start.getTime()+median),estimated:true,provenance:'provider_peer_duration'};}
  if(input.adapterDurationMs!=null&&validDuration(input.adapterDurationMs))return {end:new Date(input.start.getTime()+input.adapterDurationMs),estimated:true,provenance:'adapter_rule'};
  if(input.civilDayEnd)return {end:input.civilDayEnd,estimated:true,provenance:'civil_day_fallback'};
  throw new Error('Aucune fin théorique fiable disponible.');
}

export function isFinalizationEligible(end:Date,now:Date,graceDays:number){const deadline=new Date(end);deadline.setUTCDate(deadline.getUTCDate()+graceDays);return now<=deadline;}

export class DurableAcquisitionOrchestrator{
  constructor(readonly clock:Clock=systemClock,readonly transactions=new AcquisitionTransactionService(new PersistentSchedulerService(clock),clock)){}

  async ensureState(providerChampionshipId:string){
    const now=this.clock.now();
    await pool.query(`insert into provider_acquisition_state(provider_championship_id,bootstrap_state,current_cycle_started_at,deep_history_season) select id,'pending',$2,$3 from provider_championships where id=$1 on conflict(provider_championship_id) do nothing`,[providerChampionshipId,now,now.getUTCFullYear()-1]);
    return (await pool.query(`select state.*,champ.acquisition_history_mode,champ.acquisition_history_from_season,champ.acquisition_empty_season_limit,champ.acquisition_current_hot_days,champ.acquisition_finalization_grace_days,coalesce(policy.provider_timezone,'UTC') provider_timezone from provider_acquisition_state state join provider_championships champ on champ.id=state.provider_championship_id left join provider_quota_policies policy on policy.provider_instance_id=champ.provider_instance_id where state.provider_championship_id=$1`,[providerChampionshipId])).rows[0];
  }

  async chooseWork(providerChampionshipId:string,dispatchCounter=0,phase:'current'|'historical'='current'){const state=await this.ensureState(providerChampionshipId);const candidate=nextBootstrapWork(state,dispatchCounter,phase);if(candidate!=='finalization')return candidate;return await this.hasFinalizationTarget(providerChampionshipId,state.acquisition_finalization_grace_days)?candidate:'current_hot';}

  private async hasFinalizationTarget(providerChampionshipId:string,graceDays:number){return Boolean((await pool.query(`select 1 from provider_source_entities where provider_championship_id=$1 and theoretical_end_at is not null and theoretical_end_at<=$2 and theoretical_end_at+make_interval(days=>$3)>=$2 and lower(coalesce(source_data->>'status',''))<>all($4::text[]) limit 1`,[providerChampionshipId,this.clock.now(),Number(graceDays),finalStatuses])).rowCount);}

  async executeLease<P extends JsonObject,S extends JsonObject,C extends JsonObject>(input:{providerInstanceId:string;providerChampionshipId:string;season:number;dispatchCounter?:number;lease:{streamId:string;runId:string;workerId:string;generation:number};adapter:ProviderAdapter<P,S,C,AcquiredProviderSourceItem>;fetchInput:FetchWorkUnitInput<P,S,C>}){
    const state=await this.ensureState(input.providerChampionshipId);const phase=(await pool.query('select phase from sync_streams where id=$1',[input.lease.streamId])).rows[0]?.phase;if(phase!=='current'&&phase!=='historical')throw new Error('Stream acquisition absent.');const workClass=await this.chooseWork(input.providerChampionshipId,input.dispatchCounter??0,phase);if(!workClass)throw new Error('Aucun travail d’acquisition éligible.');const local=civilParts(this.clock.now(),state.provider_timezone);const expectedSeason=workClass==='deep_history'?Number(state.deep_history_season):local.year;if(input.season!==expectedSeason||input.fetchInput.season!==expectedSeason)throw new Error(`Saison contradictoire : ${expectedSeason} attendue.`);if(input.fetchInput.phase!==phase)throw new Error(`Phase contradictoire : ${phase} attendue.`);
    const safeUnitKey=`${workClass==='current_hot'?'current_global':workClass}:${expectedSeason}`;const resumable=(await pool.query(`select id from provider_acquisition_traversals where stream_id=$1 and season=$2 and safe_unit_key=$3 and status in('running','partial') and complete=false order by started_at desc limit 1`,[input.lease.streamId,expectedSeason,safeUnitKey])).rows[0]?.id;const outcome=await this.transactions.executeUnit({...input,season:expectedSeason,workClass,safeUnitKey,traversalId:resumable,adapter:input.adapter,fetchInput:{...input.fetchInput,season:expectedSeason},afterPersist:async(client,result,totals)=>{if(workClass==='current_hot')await this.classifyCurrentEntities(client,totals.traversalId,Number(state.acquisition_current_hot_days),state.provider_timezone);await this.recordOutcomeClient(client,input.providerChampionshipId,workClass,{complete:totals.complete,emptyConfirmed:totals.complete&&totals.receivedItems===0,receivedItems:totals.receivedItems});}});return {...outcome,workClass};
  }

  private async classifyCurrentEntities(client:PoolClient,traversalId:string,hotDays:number,timeZone:string){const parts=civilParts(this.clock.now(),timeZone),today=zonedInstant(parts.year,parts.month,parts.day,timeZone),hotDate=new Date(Date.UTC(parts.year,parts.month-1,parts.day+hotDays+1)),hotEnd=zonedInstant(hotDate.getUTCFullYear(),hotDate.getUTCMonth()+1,hotDate.getUTCDate(),timeZone);await client.query(`update provider_source_entities set acquisition_scope=case when provider_started_at is null then 'unclassified' when provider_started_at<$2 then 'past' when provider_started_at<$3 then 'current_hot' else 'current_future' end,updated_at=$4 where last_traversal_id=$1`,[traversalId,today,hotEnd,this.clock.now()]);}

  async recordOutcome(providerChampionshipId:string,workClass:AcquisitionWorkClass,outcome:TraversalOutcome){
    const client=await pool.connect();try{await client.query('begin');await this.recordOutcomeClient(client,providerChampionshipId,workClass,outcome);
      await client.query('commit');return this.ensureState(providerChampionshipId);
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }

  private async recordOutcomeClient(client:PoolClient,providerChampionshipId:string,workClass:AcquisitionWorkClass,outcome:TraversalOutcome){const row=(await client.query(`select state.*,champ.acquisition_history_mode,champ.acquisition_history_from_season,champ.acquisition_empty_season_limit from provider_acquisition_state state join provider_championships champ on champ.id=state.provider_championship_id where state.provider_championship_id=$1 for update of state`,[providerChampionshipId])).rows[0];if(!row)throw new Error('État acquisition absent.');
      if(workClass==='current_hot'&&outcome.complete){await client.query(`update provider_acquisition_state set bootstrap_state=case when recent_catchup_state in('complete','disabled') then case when deep_history_state in('complete','disabled') then 'complete' else 'deep_history' end else 'recent_catchup' end,current_stage='hot',current_last_complete_at=$2,last_progressed_at=$2,updated_at=$2 where provider_championship_id=$1`,[providerChampionshipId,this.clock.now()]);await client.query(`update sync_streams set state='ready',next_eligible_at=null,updated_at=$2 where provider_championship_id=$1 and phase='historical' and lease_owner is null`,[providerChampionshipId,this.clock.now()]);}
      else if(workClass==='recent_catchup'&&outcome.complete)await client.query(`update provider_acquisition_state set recent_catchup_state='complete',bootstrap_state=case when deep_history_state in('complete','disabled') then 'complete' else 'deep_history' end,last_progressed_at=$2,updated_at=$2 where provider_championship_id=$1`,[providerChampionshipId,this.clock.now()]);
      else if(workClass==='deep_history')await this.recordHistory(client,providerChampionshipId,row,outcome);
      else if(workClass==='finalization')await client.query(`update provider_acquisition_state set finalization_last_checked_at=$2,updated_at=$2 where provider_championship_id=$1`,[providerChampionshipId,this.clock.now()]);
      return row;
  }

  private async recordHistory(client:PoolClient,id:string,row:any,outcome:TraversalOutcome){const season=Number(row.deep_history_season??this.clock.now().getUTCFullYear()-1);const next=advanceDeepHistory({season,consecutiveEmpty:Number(row.consecutive_empty_seasons),emptyLimit:Number(row.acquisition_empty_season_limit),historyFromSeason:row.acquisition_history_from_season==null?null:Number(row.acquisition_history_from_season),mode:row.acquisition_history_mode,outcome});if(!next.changed)return;await client.query(`update provider_acquisition_state set deep_history_state=$2,deep_history_season=$3,consecutive_empty_seasons=$4,deep_history_completed_at=case when $2='complete' then $5::timestamptz else null end,bootstrap_state=case when $2='complete' then 'complete' else 'deep_history' end,last_progressed_at=$5,updated_at=$5 where provider_championship_id=$1`,[id,next.complete?'complete':'running',next.season,next.consecutiveEmpty,this.clock.now()]);}

  async reactivate(providerChampionshipId:string){await this.ensureState(providerChampionshipId);const client=await pool.connect();try{await client.query('begin');const row=(await client.query(`update provider_acquisition_state set bootstrap_state='current',current_stage='hot',current_cycle_started_at=$2,updated_at=$2 where provider_championship_id=$1 returning *`,[providerChampionshipId,this.clock.now()])).rows[0];await client.query(`update sync_streams set state=case when phase='current' then 'ready' when $2<>'complete' then 'ready' else 'complete' end,next_eligible_at=null,priority_boost_until=case when phase='current' then $3 else priority_boost_until end,updated_at=$3 where provider_championship_id=$1 and lease_owner is null`,[providerChampionshipId,row.deep_history_state,this.clock.now()]);await client.query('commit');return row;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}

  async refreshTheoreticalEnds(providerChampionshipId:string,adapterDurationMs:number|null=null,timeZone?:string){const client=await pool.connect();try{await client.query('begin');const configuredZone=timeZone??(await client.query(`select coalesce(policy.provider_timezone,'UTC') as provider_timezone from provider_championships championship left join provider_quota_policies policy on policy.provider_instance_id=championship.provider_instance_id where championship.id=$1`,[providerChampionshipId])).rows[0]?.provider_timezone??'UTC';const rows=(await client.query(`select * from provider_source_entities where provider_championship_id=$1 and provider_started_at is not null for update`,[providerChampionshipId])).rows;for(const row of rows){const sourceType=row.source_data?.type??null;const peers=rows.filter(peer=>peer.entity_kind===row.entity_kind&&(peer.source_data?.type??null)===sourceType&&peer.provider_started_at&&peer.provider_ended_at).map(peer=>new Date(peer.provider_ended_at).getTime()-new Date(peer.provider_started_at).getTime());const children=(await client.query(`select provider_ended_at from provider_source_entities where parent_source_entity_id=$1 and provider_ended_at is not null`,[row.id])).rows.map(value=>new Date(value.provider_ended_at));const start=new Date(row.provider_started_at),civil=civilDayEndUtc(start,configuredZone);const estimate=estimateTheoreticalEnd({start,providerEnd:row.provider_ended_at?new Date(row.provider_ended_at):null,sessionEnds:children,comparableDurationsMs:peers,adapterDurationMs,civilDayEnd:civil});await client.query(`update provider_source_entities set theoretical_end_at=$2,end_estimated=$3,end_provenance=$4,updated_at=$5 where id=$1`,[row.id,estimate.end,estimate.estimated,estimate.provenance,this.clock.now()]);}await client.query('commit');return rows.length;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}

  async evaluateFinalization(providerChampionshipId:string){const client=await pool.connect();try{await client.query('begin');const config=(await client.query('select acquisition_finalization_grace_days from provider_championships where id=$1',[providerChampionshipId])).rows[0];if(!config)throw new Error('Championnat fournisseur absent.');const overdue=(await client.query(`select id,external_id,source_data,theoretical_end_at,end_provenance from provider_source_entities where provider_championship_id=$1 and theoretical_end_at is not null and theoretical_end_at+make_interval(days=>$2)<$3 and lower(coalesce(source_data->>'status','')) not in('completed','finished','final')`,[providerChampionshipId,Number(config.acquisition_finalization_grace_days),this.clock.now()])).rows;for(const row of overdue)await client.query(`insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,first_seen_at,last_seen_at) values($1,$2,$3,'event_not_finalized_after_grace_period','entity',$4::jsonb,$5,$5) on conflict(provider_championship_id,anomaly_key) where state='active' do update set last_seen_at=excluded.last_seen_at,details=excluded.details,updated_at=excluded.last_seen_at`,[randomUUID(),providerChampionshipId,`event_not_finalized_after_grace_period:${row.external_id}`,JSON.stringify({external_id:row.external_id,theoretical_end_at:row.theoretical_end_at,end_provenance:row.end_provenance,status:row.source_data.status??null}),this.clock.now()]);await client.query(`update provider_acquisition_anomalies anomaly set state='resolved',resolved_at=$2,updated_at=$2 where anomaly.provider_championship_id=$1 and anomaly.anomaly_type='event_not_finalized_after_grace_period' and anomaly.state='active' and not exists(select 1 from provider_source_entities entity where entity.provider_championship_id=$1 and anomaly.anomaly_key='event_not_finalized_after_grace_period:'||entity.external_id and entity.theoretical_end_at is not null and entity.theoretical_end_at+make_interval(days=>$3)<$2 and lower(coalesce(entity.source_data->>'status','')) not in('completed','finished','final'))`,[providerChampionshipId,this.clock.now(),Number(config.acquisition_finalization_grace_days)]);await client.query('update provider_acquisition_state set finalization_last_checked_at=$2,updated_at=$2 where provider_championship_id=$1',[providerChampionshipId,this.clock.now()]);await client.query('commit');return {overdue:overdue.length};}catch(error){await client.query('rollback');throw error;}finally{client.release();}}
}
