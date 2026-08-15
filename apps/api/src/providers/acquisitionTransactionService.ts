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
  started:date(data.starts_at??data.start_at??data.strTimestamp??data.dateEvent??data.date),
  ended:date(data.ends_at??data.end_at)
});
const staleWorker=()=>Object.assign(new Error('stale_worker'),{statusCode:409});

export class AcquisitionTransactionService{
  constructor(readonly scheduler=new PersistentSchedulerService(),readonly clock:Clock=systemClock){}

  async executeUnit<P extends JsonObject,S extends JsonObject,C extends JsonObject>(input:UnitContext&{
    adapter:ProviderAdapter<P,S,C,AcquiredProviderSourceItem>;
    fetchInput:FetchWorkUnitInput<P,S,C>;
    traversalId?:string;
    beforeCommit?:()=>Promise<void>;
    afterPersist?:(client:PoolClient,result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>)=>Promise<void>;
  }){
    const traversalId=input.traversalId??randomUUID();
    if(input.traversalId){
      const resumed=(await pool.query(`update provider_acquisition_traversals traversal set run_id=$2,lease_generation=$7,status='running',finished_at=null from sync_streams stream,sync_runs run where traversal.id=$1 and traversal.stream_id=$3 and traversal.work_class=$4 and traversal.season=$5 and traversal.safe_unit_key=$6 and traversal.status in('running','partial') and traversal.complete=false and stream.id=traversal.stream_id and stream.lease_owner=$8 and stream.lease_generation=$7 and stream.lease_expires_at>$9 and run.id=$2 and run.stream_id=stream.id and run.worker_id=$8 and run.lease_generation=$7 and run.status='running' returning traversal.id`,[traversalId,input.lease.runId,input.lease.streamId,input.workClass,input.season,input.safeUnitKey,input.lease.generation,input.lease.workerId,this.clock.now()])).rowCount;
      if(!resumed)throw staleWorker();
    }else{
      const created=(await pool.query(`insert into provider_acquisition_traversals(id,stream_id,run_id,lease_generation,work_class,season,safe_unit_key) select $1,stream.id,$2,$7,$4,$5,$6 from sync_streams stream join sync_runs run on run.id=$2 and run.stream_id=stream.id and run.worker_id=$8 and run.lease_generation=$7 and run.status='running' where stream.id=$3 and stream.lease_owner=$8 and stream.lease_generation=$7 and stream.lease_expires_at>$9 returning id`,[traversalId,input.lease.runId,input.lease.streamId,input.workClass,input.season,input.safeUnitKey,input.lease.generation,input.lease.workerId,this.clock.now()])).rowCount;
      if(!created)throw staleWorker();
    }
    let result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>;
    try{result=await input.adapter.fetchWorkUnit(input.fetchInput);}
    catch(error){await this.recordBlockingFailure(traversalId,input.providerChampionshipId,error,input.lease);await this.scheduler.fail({...input.lease,durable:true,code:error instanceof ProviderAcquisitionError?error.anomaly.code:'acquisition_failed'});throw error;}
    if(result.status==='cursor_invalid'){
      await pool.query(`update provider_acquisition_traversals set status='partial',received_items=$2,valid_items=$3,anomaly_items=$4,finished_at=$5 where id=$1 and run_id=$6 and lease_generation=$7 and complete=false`,[traversalId,result.items.length+result.itemAnomalies.length,result.items.length,result.itemAnomalies.length,this.clock.now(),input.lease.runId,input.lease.generation]);
      await this.scheduler.fail({...input.lease,durable:false,code:'cursor_invalid'});
      return {traversalId,result,checkpointAdvanced:false};
    }
    try{
      await input.beforeCommit?.();
      await this.scheduler.commit({
        ...input.lease,
        cursorAfter:result.nextCursor,
        apply:client=>this.persistUnit(client,{...input,traversalId,result})
      });
    }catch(error){await this.closeTraversalFailure(traversalId,input.lease);throw error;}
    return {traversalId,result,checkpointAdvanced:true};
  }

  private async persistUnit<C extends JsonObject>(client:PoolClient,input:UnitContext&{traversalId:string;result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>;afterPersist?:(client:PoolClient,result:FetchWorkUnitResult<AcquiredProviderSourceItem,C>)=>Promise<void>}){
    const now=this.clock.now();
    for(const item of input.result.items){
      if(Boolean(item.parentExternalId)!==Boolean(item.parentEntityKind))throw new Error('Référence parent source incomplète.');
      const sourceData=sanitizeProviderSourceData(item.sourceData),sourceHash=hash(sourceData),times=temporal(sourceData);
      const previous=(await client.query(`select * from provider_source_entities where provider_championship_id=$1 and entity_kind=$2 and external_id=$3 for update`,[input.providerChampionshipId,item.entityKind,item.externalId])).rows[0];
      const id=previous?.id??randomUUID();
      await client.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,identity_is_synthetic,parent_external_id,parent_entity_kind,season,source_data,source_hash,provider_started_at,provider_ended_at,first_observed_at,last_observed_at,last_changed_at,last_traversal_id,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$14,$14,$15,$14) on conflict(provider_championship_id,entity_kind,external_id) do update set identity_is_synthetic=excluded.identity_is_synthetic,parent_external_id=excluded.parent_external_id,parent_entity_kind=excluded.parent_entity_kind,season=excluded.season,source_data=excluded.source_data,source_hash=excluded.source_hash,provider_started_at=excluded.provider_started_at,provider_ended_at=excluded.provider_ended_at,last_observed_at=excluded.last_observed_at,last_changed_at=case when provider_source_entities.source_hash<>excluded.source_hash then excluded.last_changed_at else provider_source_entities.last_changed_at end,last_traversal_id=excluded.last_traversal_id,updated_at=excluded.updated_at`,[id,input.providerInstanceId,input.providerChampionshipId,item.entityKind,item.externalId,item.identityIsSynthetic,item.parentExternalId,item.parentEntityKind,item.season,JSON.stringify(sourceData),sourceHash,times.started,times.ended,now,input.traversalId]);
      const entity=(await client.query(`select id from provider_source_entities where provider_championship_id=$1 and entity_kind=$2 and external_id=$3`,[input.providerChampionshipId,item.entityKind,item.externalId])).rows[0];
      await client.query(`insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at) values($1,$2,'present',$3) on conflict(traversal_id,source_entity_id) do update set observation_kind='present',observed_at=excluded.observed_at`,[input.traversalId,entity.id,now]);
      if(!previous||previous.source_hash!==sourceHash){const override=(await client.query(`select exists(select 1 from provider_championships pc join provider_instances p on p.id=pc.provider_instance_id join events e on e.championship_id=pc.championship_id and e.provider_key=p.adapter_key and e.external_id=$2 join event_corrections c on c.event_id=e.id and c.status in('active','conflict') where pc.id=$1) active`,[input.providerChampionshipId,item.externalId])).rows[0]?.active===true;await client.query(`insert into provider_source_changes(source_entity_id,traversal_id,change_type,field_name,old_value,new_value,origin,manual_override_active,changed_at) values($1,$2,$3,'source_hash',$4::jsonb,$5::jsonb,'provider',$6,$7)`,[entity.id,input.traversalId,previous?'source_updated':'source_created',previous?JSON.stringify(previous.source_hash):null,JSON.stringify(sourceHash),override,now]);}
    }
    await client.query(`update provider_source_entities child set parent_source_entity_id=parent.id from provider_source_entities parent where child.provider_championship_id=$1 and child.parent_external_id is not null and child.parent_entity_kind is not null and parent.provider_championship_id=child.provider_championship_id and parent.entity_kind=child.parent_entity_kind and parent.external_id=child.parent_external_id and child.parent_source_entity_id is distinct from parent.id`,[input.providerChampionshipId]);
    for(const anomaly of input.result.itemAnomalies)await this.upsertAnomaly(client,input.providerChampionshipId,anomaly,now);
    const complete=input.result.complete;
    const totals=(await client.query(`update provider_acquisition_traversals set status=case when $2::boolean then 'complete' else 'running' end,complete=$2,received_items=received_items+$3,valid_items=valid_items+$4,anomaly_items=anomaly_items+$5,finished_at=case when $2 then $6::timestamptz else null end where id=$1 and run_id=$7 and lease_generation=$8 and complete=false returning received_items,valid_items`,[input.traversalId,complete,input.result.items.length+input.result.itemAnomalies.length,input.result.items.length,input.result.itemAnomalies.length,now,input.lease.runId,input.lease.generation])).rows[0];
    if(!totals)throw new Error('Traversal déjà clos.');
    if(complete){
      if(Number(totals.received_items)===0)await client.query(`update provider_acquisition_traversals set status='empty_confirmed' where id=$1 and run_id=$2 and lease_generation=$3`,[input.traversalId,input.lease.runId,input.lease.generation]);
      await client.query(`insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at) select $1,entity.id,'not_observed',$4 from provider_source_entities entity where entity.provider_championship_id=$2 and entity.season=$3 and not exists(select 1 from provider_source_observations observed where observed.traversal_id=$1 and observed.source_entity_id=entity.id and observed.observation_kind='present') on conflict(traversal_id,source_entity_id) do nothing`,[input.traversalId,input.providerChampionshipId,input.season,now]);
    }
    await input.afterPersist?.(client,input.result);
  }

  private async upsertAnomaly(client:PoolClient,providerChampionshipId:string,anomaly:ProviderItemAnomaly,now:Date){
    const key=`${anomaly.code}:${anomaly.externalId??`index-${anomaly.index}`}`;
    await client.query(`insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,first_seen_at,last_seen_at) values($1,$2,$3,$4,'entity',$5::jsonb,$6,$6) on conflict(provider_championship_id,anomaly_key) where state='active' do update set last_seen_at=excluded.last_seen_at,occurrence_count=provider_acquisition_anomalies.occurrence_count+1,details=excluded.details,updated_at=excluded.last_seen_at`,[randomUUID(),providerChampionshipId,key,anomaly.code,JSON.stringify({index:anomaly.index,external_id:anomaly.externalId,message:anomaly.message}),now]);
  }

  private async recordBlockingFailure(traversalId:string,providerChampionshipId:string,error:unknown,lease:Lease){
    const now=this.clock.now(),code=error instanceof ProviderAcquisitionError?error.anomaly.code:'acquisition_failed';
    const client=await pool.connect();try{await client.query('begin');const owned=await client.query(`update provider_acquisition_traversals set status='failed',complete=false,finished_at=$2 where id=$1 and run_id=$3 and lease_generation=$4 and complete=false returning id`,[traversalId,now,lease.runId,lease.generation]);if(owned.rowCount)await client.query(`insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,first_seen_at,last_seen_at) values($1,$2,$3,$3,'stream','{}',$4,$4) on conflict(provider_championship_id,anomaly_key) where state='active' do update set last_seen_at=excluded.last_seen_at,occurrence_count=provider_acquisition_anomalies.occurrence_count+1,updated_at=excluded.last_seen_at`,[randomUUID(),providerChampionshipId,`stream:${code}`,now]);await client.query('commit');}catch(failure){await client.query('rollback');throw failure;}finally{client.release();}
  }

  private async closeTraversalFailure(traversalId:string,lease:Lease){
    await pool.query(`update provider_acquisition_traversals set status='failed',complete=false,finished_at=$2 where id=$1 and run_id=$3 and lease_generation=$4 and complete=false`,[traversalId,this.clock.now(),lease.runId,lease.generation]);
  }
}
