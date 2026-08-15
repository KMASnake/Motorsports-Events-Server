import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db.js';
import type { AcquiredProviderSourceItem, FetchWorkUnitInput, FetchWorkUnitResult, JsonObject, ProviderAdapter, ProviderItemAnomaly } from './contracts.js';
import { ProviderAcquisitionError } from './contracts.js';
import type { Clock } from './schedulerService.js';
import { PersistentSchedulerService, systemClock } from './schedulerService.js';
import { sanitizeProviderSourceData } from './sourceStorage.js';

type WorkClass='current_hot'|'current_future'|'finalization'|'recent_catchup'|'deep_history';
type Lease={streamId:string;runId:string;workerId:string;generation:number};
type UnitContext={providerInstanceId:string;providerChampionshipId:string;season:number;workClass:WorkClass;safeUnitKey:string;lease:Lease};

const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right)).map(([key,nested])=>[key,canonical(nested)])):value;
const hash=(value:JsonObject)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const date=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?new Date(value):null;
const temporal=(data:JsonObject)=>({
  started:date(data.starts_at??data.start_at??data.dateEvent??data.date),
  ended:date(data.ends_at??data.end_at??data.strTimestamp)
});

export class AcquisitionTransactionService{
  constructor(readonly scheduler=new PersistentSchedulerService(),readonly clock:Clock=systemClock){}

  async executeUnit<P extends JsonObject,S extends JsonObject,C extends JsonObject>(input:UnitContext&{
    adapter:ProviderAdapter<P,S,C,AcquiredProviderSourceItem>;
    fetchInput:FetchWorkUnitInput<P,S,C>;
    beforeCommit?:()=>Promise<void>;
  }){
    const traversalId=randomUUID();
    await pool.query(`insert into provider_acquisition_traversals(id,stream_id,run_id,work_class,season,safe_unit_key) values($1,$2,$3,$4,$5,$6)`,[traversalId,input.lease.streamId,input.lease.runId,input.workClass,input.season,input.safeUnitKey]);
    let result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>;
    try{result=await input.adapter.fetchWorkUnit(input.fetchInput);}
    catch(error){await this.recordBlockingFailure(traversalId,input.providerChampionshipId,error);await this.scheduler.fail({...input.lease,durable:true,code:error instanceof ProviderAcquisitionError?error.anomaly.code:'acquisition_failed'});throw error;}
    if(result.status==='cursor_invalid'){
      await pool.query(`update provider_acquisition_traversals set status='partial',received_items=$2,valid_items=$3,anomaly_items=$4,finished_at=$5 where id=$1`,[traversalId,result.items.length+result.itemAnomalies.length,result.items.length,result.itemAnomalies.length,this.clock.now()]);
      await this.scheduler.fail({...input.lease,durable:false,code:'cursor_invalid'});
      return {traversalId,result,checkpointAdvanced:false};
    }
    await input.beforeCommit?.();
    await this.scheduler.commit({
      ...input.lease,
      cursorAfter:result.nextCursor,
      apply:client=>this.persistUnit(client,{...input,traversalId,result})
    });
    return {traversalId,result,checkpointAdvanced:true};
  }

  private async persistUnit<C extends JsonObject>(client:PoolClient,input:UnitContext&{traversalId:string;result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>}){
    const now=this.clock.now();
    const seen:string[]=[];
    for(const item of input.result.items){
      const sourceData=sanitizeProviderSourceData(item.sourceData),sourceHash=hash(sourceData),times=temporal(sourceData);
      const previous=(await client.query(`select * from provider_source_entities where provider_championship_id=$1 and entity_kind=$2 and external_id=$3 for update`,[input.providerChampionshipId,item.entityKind,item.externalId])).rows[0];
      const id=previous?.id??randomUUID();
      await client.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,identity_is_synthetic,season,source_data,source_hash,provider_started_at,provider_ended_at,first_observed_at,last_observed_at,last_changed_at,last_traversal_id,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$12,$12,$13,$12) on conflict(provider_championship_id,entity_kind,external_id) do update set identity_is_synthetic=excluded.identity_is_synthetic,season=excluded.season,source_data=excluded.source_data,source_hash=excluded.source_hash,provider_started_at=excluded.provider_started_at,provider_ended_at=excluded.provider_ended_at,last_observed_at=excluded.last_observed_at,last_changed_at=case when provider_source_entities.source_hash<>excluded.source_hash then excluded.last_changed_at else provider_source_entities.last_changed_at end,last_traversal_id=excluded.last_traversal_id,updated_at=excluded.updated_at`,[id,input.providerInstanceId,input.providerChampionshipId,item.entityKind,item.externalId,item.identityIsSynthetic,item.season,JSON.stringify(sourceData),sourceHash,times.started,times.ended,now,input.traversalId]);
      const entity=(await client.query(`select id from provider_source_entities where provider_championship_id=$1 and entity_kind=$2 and external_id=$3`,[input.providerChampionshipId,item.entityKind,item.externalId])).rows[0];
      seen.push(entity.id);
      await client.query(`insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at) values($1,$2,'present',$3) on conflict(traversal_id,source_entity_id) do update set observation_kind='present',observed_at=excluded.observed_at`,[input.traversalId,entity.id,now]);
      if(!previous||previous.source_hash!==sourceHash){const override=(await client.query(`select exists(select 1 from provider_championships pc join provider_instances p on p.id=pc.provider_instance_id join events e on e.championship_id=pc.championship_id and e.provider_key=p.adapter_key and e.external_id=$2 join event_corrections c on c.event_id=e.id and c.status in('active','conflict') where pc.id=$1) active`,[input.providerChampionshipId,item.externalId])).rows[0]?.active===true;await client.query(`insert into provider_source_changes(source_entity_id,traversal_id,change_type,field_name,old_value,new_value,origin,manual_override_active,changed_at) values($1,$2,$3,'source_hash',$4::jsonb,$5::jsonb,'provider',$6,$7)`,[entity.id,input.traversalId,previous?'source_updated':'source_created',previous?JSON.stringify(previous.source_hash):null,JSON.stringify(sourceHash),override,now]);}
    }
    for(const item of input.result.items){if(!item.parentExternalId)continue;await client.query(`update provider_source_entities child set parent_source_entity_id=parent.id from provider_source_entities parent where child.provider_championship_id=$1 and child.entity_kind=$2 and child.external_id=$3 and parent.provider_championship_id=child.provider_championship_id and parent.external_id=$4`,[input.providerChampionshipId,item.entityKind,item.externalId,item.parentExternalId]);}
    for(const anomaly of input.result.itemAnomalies)await this.upsertAnomaly(client,input.providerChampionshipId,anomaly,now);
    const complete=input.result.complete;
    await client.query(`update provider_acquisition_traversals set status=$2,complete=$3,received_items=$4,valid_items=$5,anomaly_items=$6,finished_at=$7 where id=$1`,[input.traversalId,complete?(input.result.items.length?'complete':'empty_confirmed'):'partial',complete,input.result.items.length+input.result.itemAnomalies.length,input.result.items.length,input.result.itemAnomalies.length,now]);
    if(complete)await client.query(`insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at) select $1,id,'not_observed',$4 from provider_source_entities where provider_championship_id=$2 and season=$3 and not(id=any($5::uuid[])) on conflict(traversal_id,source_entity_id) do nothing`,[input.traversalId,input.providerChampionshipId,input.season,now,seen]);
  }

  private async upsertAnomaly(client:PoolClient,providerChampionshipId:string,anomaly:ProviderItemAnomaly,now:Date){
    const key=`${anomaly.code}:${anomaly.externalId??`index-${anomaly.index}`}`;
    await client.query(`insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,first_seen_at,last_seen_at) values($1,$2,$3,$4,'entity',$5::jsonb,$6,$6) on conflict(provider_championship_id,anomaly_key) where state='active' do update set last_seen_at=excluded.last_seen_at,occurrence_count=provider_acquisition_anomalies.occurrence_count+1,details=excluded.details,updated_at=excluded.last_seen_at`,[randomUUID(),providerChampionshipId,key,anomaly.code,JSON.stringify({index:anomaly.index,external_id:anomaly.externalId,message:anomaly.message}),now]);
  }

  private async recordBlockingFailure(traversalId:string,providerChampionshipId:string,error:unknown){
    const now=this.clock.now(),code=error instanceof ProviderAcquisitionError?error.anomaly.code:'acquisition_failed';
    const client=await pool.connect();try{await client.query('begin');await client.query(`update provider_acquisition_traversals set status='failed',complete=false,finished_at=$2 where id=$1`,[traversalId,now]);await client.query(`insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,first_seen_at,last_seen_at) values($1,$2,$3,$3,'stream','{}',$4,$4) on conflict(provider_championship_id,anomaly_key) where state='active' do update set last_seen_at=excluded.last_seen_at,occurrence_count=provider_acquisition_anomalies.occurrence_count+1,updated_at=excluded.last_seen_at`,[randomUUID(),providerChampionshipId,`stream:${code}`,now]);await client.query('commit');}catch(failure){await client.query('rollback');throw failure;}finally{client.release();}
  }
}
