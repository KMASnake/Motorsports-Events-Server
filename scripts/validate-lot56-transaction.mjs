import assert from 'node:assert/strict';
import { pool } from '../apps/api/dist/lib/db.js';
import { AcquisitionTransactionService } from '../apps/api/dist/providers/acquisitionTransactionService.js';
import { PersistentSchedulerService } from '../apps/api/dist/providers/schedulerService.js';
import { ProviderAcquisitionError } from '../apps/api/dist/providers/contracts.js';

const providerId='56c00000-0000-0000-0000-000000000001';
const linkId='56c00000-0000-0000-0000-000000000002';
const streamId='56c00000-0000-0000-0000-000000000003';
const worker='lot56-c-worker';
const scheduler=new PersistentSchedulerService();
const service=new AcquisitionTransactionService(scheduler);
const cursor=(page)=>({page,visited:page===1?[]:['page:1']});
const item=(externalId,sourceData={},season=2026)=>({entityKind:'event',externalId,identityIsSynthetic:false,parentExternalId:null,season,sourceData});
const result=(items,next=2,complete=false,itemAnomalies=[])=>({status:complete?'complete':'progress',items,itemAnomalies,nextCursor:cursor(next),requestCount:1,complete,completionReason:complete?(items.length?'end_of_collection':'explicit_empty_scope'):null});
const adapter=(value)=>({fetchWorkUnit:async()=>{if(value instanceof Error)throw value;return value;}});
const fetchInput={providerInstanceId:providerId,providerConfig:{},credentials:{},providerChampionshipId:linkId,championshipId:'f1',sourceConfig:{},phase:'current',season:2026,cursor:cursor(1),signal:new AbortController().signal};

async function lease(){
  await pool.query("update sync_streams set state='ready',lease_owner=null,lease_acquired_at=null,lease_expires_at=null,next_eligible_at=null where id=$1",[streamId]);
  const acquired=await scheduler.acquire(worker);assert(acquired&&acquired.stream.id===streamId);
  return {streamId,runId:acquired.run_id,workerId:worker,generation:acquired.lease_generation};
}
async function execute(providerResult,extra={}){
  const currentLease=await lease();
  return service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:`page-${Date.now()}-${Math.random()}`,lease:currentLease,adapter:adapter(providerResult),fetchInput,...extra});
}
async function scalar(sql,params=[]){return (await pool.query(sql,params)).rows[0];}

try{
  await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'lot56-c-fixture','Lot 5.6-C fixture',true,'active')`,[providerId]);
  await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,'f1','fixture-f1','configured','active',true)`,[linkId,providerId]);
  await pool.query(`insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor) values($1,$2,'current','ready',1,$3::jsonb)`,[streamId,linkId,JSON.stringify(cursor(1))]);

  await execute(result([item('historic', {name:'Historic GP',starts_at:'1950-05-13T11:00:00Z',ends_at:'1950-05-13T13:00:00Z'})]));
  assert.equal((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor.page,2);
  assert.equal(Number((await scalar('select count(*) count from provider_source_entities where provider_championship_id=$1',[linkId])).count),1);
  console.log('Unité valide, date pré-1970, commit et checkpoint : OK');

  await execute(result([item('historic', {ends_at:'1950-05-13T13:00:00Z',starts_at:'1950-05-13T11:00:00Z',name:'Historic GP'})],3));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='historic'")).count),1);
  assert.equal(Number((await scalar('select count(*) count from provider_source_changes')).count),1);
  console.log('Replay idempotent sans doublon ni faux changement : OK');

  await execute(result([item('historic', {name:'Historic GP revised',starts_at:'1950-05-13T12:00:00Z'})],4));
  assert.equal(Number((await scalar("select count(*) count from provider_source_changes where change_type='source_updated'")).count),1);
  console.log('Changement source par upsert et journal fonctionnel : OK');

  const anomaly={scope:'item',index:1,code:'invalid_provider_item',message:'Invalid item',externalId:'broken'};
  await execute(result([item('valid-with-anomaly',{name:'Valid'})],5,false,[anomaly]));
  await execute(result([item('valid-with-anomaly',{name:'Valid'})],6,false,[anomaly]));
  assert.equal(Number((await scalar("select occurrence_count from provider_acquisition_anomalies where anomaly_key='invalid_provider_item:broken' and state='active'")).occurrence_count),2);
  console.log('Item valide conservé et anomalie répétée agrégée : OK');

  const beforeFailure=(await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor;
  await assert.rejects(()=>execute(new ProviderAcquisitionError('invalid_provider_payload','Malformed stream')));
  assert.deepEqual((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor,beforeFailure);
  assert.equal((await scalar("select status from provider_acquisition_traversals order by created_at desc limit 1")).status,'failed');
  console.log('Anomalie structurelle, rollback logique et checkpoint inchangé : OK');

  const crashLease=await lease();
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'crash-before-commit',lease:crashLease,adapter:adapter(result([item('crash-item',{name:'Crash'})],7)),fetchInput,beforeCommit:async()=>{throw new Error('simulated_crash');}}),/simulated_crash/);
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='crash-item'")).count),0);
  assert.deepEqual((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor,beforeFailure);
  console.log('Crash avant commit : checkpoint inchangé et aucune donnée partielle : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  await execute(result([item('crash-item',{name:'Crash replay'})],7));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='crash-item'")).count),1);
  console.log('Replay après crash sans doublon : OK');

  const staleLease=await lease();await pool.query('update sync_streams set lease_generation=lease_generation+1 where id=$1',[streamId]);
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'stale',lease:staleLease,adapter:adapter(result([item('stale-item')],8)),fetchInput}),/stale_worker/);
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='stale-item'")).count),0);
  console.log('Fencing stale refuse commit et checkpoint : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const lostLease=await lease();await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'lost',lease:lostLease,adapter:adapter(result([item('lost-item')],8)),fetchInput}),/stale_worker/);
  console.log('Lease perdue refuse commit : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const cursorBeforeInvalid=(await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor;
  const cursorLease=await lease();const cursorInvalid={...result([],1,false),status:'cursor_invalid',safeRestart:{scope:'season',season:2026}};
  const cursorOutcome=await service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'cursor-invalid',lease:cursorLease,adapter:adapter(cursorInvalid),fetchInput});
  assert.equal(cursorOutcome.checkpointAdvanced,false);assert.deepEqual((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor,cursorBeforeInvalid);
  console.log('Cursor invalid : checkpoint non avancé : OK');

  await execute(result([item('partial-seen',{name:'Partial'})],9,false));
  assert.equal(Number((await scalar("select count(*) count from provider_source_observations where observation_kind='not_observed' and traversal_id=(select id from provider_acquisition_traversals order by created_at desc limit 1)")).count),0);
  await execute(result([],10,true));
  assert(Number((await scalar("select count(*) count from provider_source_observations where observation_kind='not_observed' and traversal_id=(select id from provider_acquisition_traversals order by created_at desc limit 1)")).count)>0);
  console.log('Traversal partiel sans absence, traversal complet avec non-observations : OK');

  await pool.query(`insert into event_corrections(id,event_id,provider_key,field_name,provider_value,override_value,status,created_by) values('lot56-c-override','evt-002','fixture','name','"Provider"','"Local"','active','maintainer') on conflict(event_id,field_name) do update set override_value='"Local"',status='active'`);
  await pool.query("update events set provider_key='lot56-c-fixture',external_id='override-safe' where id='evt-002'");
  await Promise.all([
    execute(result([item('override-safe',{name:'Provider changed'})],11)),
    pool.query(`update event_corrections set override_value='"Local"'::jsonb,updated_at=now() where id='lot56-c-override'`)
  ]);
  assert.equal((await scalar("select override_value from event_corrections where id='lot56-c-override'")).override_value,'Local');
  assert.equal((await scalar("select manual_override_active from provider_source_changes where source_entity_id=(select id from provider_source_entities where external_id='override-safe') order by id desc limit 1")).manual_override_active,true);
  console.log('Override actif préservé pendant mise à jour source : OK');

  const secret='LOT56_C_CANARY_SECRET';
  await execute(result([item('sanitized',{name:'Safe',apiKey:secret,nested:{accessToken:secret}})],12));
  const serialized=JSON.stringify(await scalar("select source_data from provider_source_entities where external_id='sanitized'"));assert(!serialized.includes(secret));
  const journals=JSON.stringify((await pool.query('select old_value,new_value from provider_source_changes')).rows);const anomalies=JSON.stringify((await pool.query('select details from provider_acquisition_anomalies')).rows);assert(!journals.includes(secret)&&!anomalies.includes(secret));
  console.log('Aucun secret dans source, journal ou anomalies : OK');

  const checkpointBeforeDbError=(await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor;
  const badLease=await lease();const bad=result([item('db-error',{starts_at:'2026-01-02T00:00:00Z',ends_at:'2026-01-01T00:00:00Z'})],13);
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'db-error',lease:badLease,adapter:adapter(bad),fetchInput}));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='db-error'")).count),0);
  assert.deepEqual((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor,checkpointBeforeDbError);
  console.log('Erreur PostgreSQL : transaction annulée sans donnée partielle : OK');
  console.log('Tests PostgreSQL Lot 5.6-C : OK');
} finally { await pool.end(); }
