import assert from 'node:assert/strict';
import { pool } from '../apps/api/dist/lib/db.js';
import { AcquisitionTransactionService } from '../apps/api/dist/providers/acquisitionTransactionService.js';
import { PersistentSchedulerService } from '../apps/api/dist/providers/schedulerService.js';
import { ProviderAcquisitionError } from '../apps/api/dist/providers/contracts.js';

const providerId='56c00000-0000-0000-0000-000000000001';
const linkId='56c00000-0000-0000-0000-000000000002';
const streamId='56c00000-0000-0000-0000-000000000003';
const providerId2='56c00000-0000-0000-0000-000000000011';
const linkId2='56c00000-0000-0000-0000-000000000012';
const worker='lot56-c-worker';
const scheduler=new PersistentSchedulerService();
const service=new AcquisitionTransactionService(scheduler);
const cursor=(page)=>({page,visited:page===1?[]:['page:1']});
const item=(externalId,sourceData={},season=2026,extra={})=>({entityKind:'event',externalId,identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season,sourceData,...extra});
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
  await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'lot56-c-other','Other scope',true,'active')`,[providerId2]);
  await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,'f1','other-f1','configured','inactive',false)`,[linkId2,providerId2]);

  await execute(result([item('historic', {name:'Historic GP',starts_at:'1950-05-13T11:00:00Z',ends_at:'1950-05-13T13:00:00Z'})]));
  assert.equal((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor.page,2);
  assert.equal(Number((await scalar('select count(*) count from provider_source_entities where provider_championship_id=$1',[linkId])).count),1);
  console.log('Unité valide, date pré-1970, commit et checkpoint : OK');

  await execute(result([item('timestamp-start',{strTimestamp:'1969-07-20T20:17:00Z'})],21));
  const timestampRow=await scalar("select provider_started_at,provider_ended_at from provider_source_entities where external_id='timestamp-start'");
  assert.equal(new Date(timestampRow.provider_started_at).toISOString(),'1969-07-20T20:17:00.000Z');assert.equal(timestampRow.provider_ended_at,null);
  await execute(result([item('explicit-end',{date:'1900-01-01T00:00:00Z',end_at:'1900-01-01T01:00:00Z'})],22));
  const explicitEnd=await scalar("select provider_started_at,provider_ended_at from provider_source_entities where external_id='explicit-end'");
  assert.equal(new Date(explicitEnd.provider_started_at).toISOString(),'1900-01-01T00:00:00.000Z');assert.equal(new Date(explicitEnd.provider_ended_at).toISOString(),'1900-01-01T01:00:00.000Z');
  console.log('strTimestamp classé en début, fin explicite et dates historiques : OK');

  await execute(result([item('historic', {ends_at:'1950-05-13T13:00:00Z',starts_at:'1950-05-13T11:00:00Z',name:'Historic GP'})],3));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='historic'")).count),1);
  assert.equal(Number((await scalar("select count(*) count from provider_source_changes where source_entity_id=(select id from provider_source_entities where external_id='historic')")).count),1);
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
  assert.equal((await scalar("select status,complete from provider_acquisition_traversals where safe_unit_key='crash-before-commit'")).status,'failed');
  console.log('Crash avant commit : checkpoint inchangé et aucune donnée partielle : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  await execute(result([item('crash-item',{name:'Crash replay'})],7));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='crash-item'")).count),1);
  console.log('Replay après crash sans doublon : OK');

  const staleLease=await lease();await pool.query('update sync_streams set lease_generation=lease_generation+1 where id=$1',[streamId]);
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'stale',lease:staleLease,adapter:adapter(result([item('stale-item')],8)),fetchInput}),/stale_worker/);
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='stale-item'")).count),0);
  assert.equal(Number((await scalar("select count(*) count from provider_acquisition_traversals where safe_unit_key='stale'")).count),0);
  console.log('Fencing stale refuse commit et checkpoint : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const lostLease=await lease();await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);
  await assert.rejects(()=>service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'lost',lease:lostLease,adapter:adapter(result([item('lost-item')],8)),fetchInput}),/stale_worker/);
  assert.equal(Number((await scalar("select count(*) count from provider_acquisition_traversals where safe_unit_key='lost'")).count),0);
  console.log('Lease perdue refuse commit : OK');

  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const orphanLease=await lease();
  await pool.query(`insert into provider_acquisition_traversals(id,stream_id,run_id,lease_generation,work_class,season,safe_unit_key) values('56c00000-0000-0000-0000-000000000099',$1,$2,$3,'current_future',2026,'orphaned-process')`,[streamId,orphanLease.runId,orphanLease.generation]);
  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  assert.deepEqual(await scalar("select status,complete from provider_acquisition_traversals where safe_unit_key='orphaned-process'"),{status:'partial',complete:false});
  console.log('Récupération lease : traversal orphelin clos sans complétude : OK');

  const raceLeaseA=await lease();let rejectA;
  const delayedA=new Promise((_,reject)=>{rejectA=reject;});
  const staleA=service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'race-a-b',lease:raceLeaseA,adapter:adapter(delayedA),fetchInput});
  let raceTraversal;
  for(let attempt=0;attempt<20&&!raceTraversal;attempt++){await new Promise(resolve=>setTimeout(resolve,25));raceTraversal=(await pool.query("select id from provider_acquisition_traversals where safe_unit_key='race-a-b'")).rows[0]?.id;}
  assert(raceTraversal);
  await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const raceLeaseB=await lease();let releaseB;const holdB=new Promise(resolve=>{releaseB=resolve;});
  const currentB=service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'race-a-b',traversalId:raceTraversal,lease:raceLeaseB,adapter:adapter(result([item('race-b')],30,true)),fetchInput,beforeCommit:()=>holdB});
  for(let attempt=0;attempt<20;attempt++){const owner=await scalar('select run_id from provider_acquisition_traversals where id=$1',[raceTraversal]);if(owner.run_id===raceLeaseB.runId)break;await new Promise(resolve=>setTimeout(resolve,25));}
  const staleAssertion=assert.rejects(()=>staleA,/stale_worker/);
  rejectA(new ProviderAcquisitionError('late-a-failure','Late A provider failure'));
  await staleAssertion;
  const duringRace=await scalar('select run_id,lease_generation,status,complete from provider_acquisition_traversals where id=$1',[raceTraversal]);
  assert.deepEqual(duringRace,{run_id:raceLeaseB.runId,lease_generation:String(raceLeaseB.generation),status:'running',complete:false});
  assert.equal(Number((await scalar("select count(*) count from provider_acquisition_anomalies where anomaly_key='stream:late-a-failure'")).count),0);
  releaseB();await currentB;
  assert.deepEqual(await scalar('select run_id,lease_generation,status,complete from provider_acquisition_traversals where id=$1',[raceTraversal]),{run_id:raceLeaseB.runId,lease_generation:String(raceLeaseB.generation),status:'complete',complete:true});
  assert.equal(Number((await scalar("select count(*) count from provider_source_observations where traversal_id=$1 and observation_kind='present'",[raceTraversal])).count),1);
  const commitLeaseA=await lease();let resolveCommitA;
  const delayedCommitA=new Promise(resolve=>{resolveCommitA=resolve;});
  const staleCommitA=service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'race-commit-a-b',lease:commitLeaseA,adapter:adapter(delayedCommitA),fetchInput});
  let commitTraversal;
  for(let attempt=0;attempt<20&&!commitTraversal;attempt++){await new Promise(resolve=>setTimeout(resolve,25));commitTraversal=(await pool.query("select id from provider_acquisition_traversals where safe_unit_key='race-commit-a-b'")).rows[0]?.id;}
  assert(commitTraversal);await pool.query("update sync_streams set lease_expires_at=now()-interval '1 second' where id=$1",[streamId]);await scheduler.recover();
  const commitLeaseB=await lease();let releaseCommitB;const holdCommitB=new Promise(resolve=>{releaseCommitB=resolve;});
  const commitB=service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'race-commit-a-b',traversalId:commitTraversal,lease:commitLeaseB,adapter:adapter(result([item('race-commit-b')],31,true)),fetchInput,beforeCommit:()=>holdCommitB});
  for(let attempt=0;attempt<20;attempt++){const owner=await scalar('select run_id from provider_acquisition_traversals where id=$1',[commitTraversal]);if(owner.run_id===commitLeaseB.runId)break;await new Promise(resolve=>setTimeout(resolve,25));}
  const staleCommitAssertion=assert.rejects(()=>staleCommitA,/stale_worker/);resolveCommitA(result([item('race-commit-a')],31,true));await staleCommitAssertion;
  assert.deepEqual(await scalar('select run_id,status,complete from provider_acquisition_traversals where id=$1',[commitTraversal]),{run_id:commitLeaseB.runId,status:'running',complete:false});
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='race-commit-a'")).count),0);
  releaseCommitB();await commitB;
  assert.deepEqual(await scalar('select run_id,status,complete from provider_acquisition_traversals where id=$1',[commitTraversal]),{run_id:commitLeaseB.runId,status:'complete',complete:true});
  console.log('Courses A/B : commit et erreur fournisseur stale sans mutation, B complète : OK');

  const cursorBeforeInvalid=(await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor;
  const cursorLease=await lease();const cursorInvalid={...result([],1,false),status:'cursor_invalid',safeRestart:{scope:'season',season:2026}};
  const cursorOutcome=await service.executeUnit({providerInstanceId:providerId,providerChampionshipId:linkId,season:2026,workClass:'current_future',safeUnitKey:'cursor-invalid',lease:cursorLease,adapter:adapter(cursorInvalid),fetchInput});
  assert.equal(cursorOutcome.checkpointAdvanced,false);assert.deepEqual((await scalar('select cursor from sync_streams where id=$1',[streamId])).cursor,cursorBeforeInvalid);
  console.log('Cursor invalid : checkpoint non avancé : OK');

  await execute(result(['A','B','C','D','OLD'].map(id=>item(`scope-${id}`)),9,true));
  const page1=await execute(result(['A','B'].map(id=>item(`scope-${id}`)),10,false),{safeUnitKey:'two-pages'});
  assert.equal((await scalar('select complete from provider_acquisition_traversals where id=$1',[page1.traversalId])).complete,false);
  const page2=await execute(result(['C','D'].map(id=>item(`scope-${id}`)),11,true),{safeUnitKey:'two-pages',traversalId:page1.traversalId});
  assert.equal(page2.traversalId,page1.traversalId);
  const observations=(await pool.query(`select e.external_id,o.observation_kind from provider_source_observations o join provider_source_entities e on e.id=o.source_entity_id where o.traversal_id=$1 and e.external_id like 'scope-%' order by e.external_id`,[page1.traversalId])).rows;
  assert.deepEqual(observations,[{external_id:'scope-A',observation_kind:'present'},{external_id:'scope-B',observation_kind:'present'},{external_id:'scope-C',observation_kind:'present'},{external_id:'scope-D',observation_kind:'present'},{external_id:'scope-OLD',observation_kind:'not_observed'}]);
  assert.equal((await scalar('select complete,status from provider_acquisition_traversals where id=$1',[page1.traversalId])).status,'complete');
  const failedPage1=await execute(result([item('scope-A')],12,false),{safeUnitKey:'two-pages-failure'});
  await assert.rejects(()=>execute(new ProviderAcquisitionError('page_failed','Page 2 failed'),{safeUnitKey:'two-pages-failure',traversalId:failedPage1.traversalId}));
  assert.equal(Number((await scalar("select count(*) count from provider_source_observations where traversal_id=$1 and observation_kind='not_observed'",[failedPage1.traversalId])).count),0);
  assert.equal((await scalar('select status,complete from provider_acquisition_traversals where id=$1',[failedPage1.traversalId])).status,'failed');
  console.log('Traversal multi-pages : présence cumulative, absence finale exacte et échec sans absence : OK');

  const childFirst=await execute(result([item('child-late-parent',{},2026,{entityKind:'session',parentExternalId:'parent-late',parentEntityKind:'meeting'})],23));
  assert.equal((await scalar("select parent_source_entity_id from provider_source_entities where external_id='child-late-parent'")).parent_source_entity_id,null);
  await execute(result([item('parent-late',{},2026,{entityKind:'meeting'})],24));
  assert((await scalar("select parent_source_entity_id from provider_source_entities where external_id='child-late-parent'")).parent_source_entity_id);
  await execute(result([item('same-id',{},2026,{entityKind:'event'}),item('same-id',{},2026,{entityKind:'meeting'}),item('child-kind',{},2026,{entityKind:'session',parentExternalId:'same-id',parentEntityKind:'meeting'})],25));
  assert.equal((await scalar(`select parent.entity_kind from provider_source_entities child join provider_source_entities parent on parent.id=child.parent_source_entity_id where child.external_id='child-kind'`)).entity_kind,'meeting');
  await execute(result([item('parent-first',{},2026,{entityKind:'meeting'}),item('child-parent-first',{},2026,{entityKind:'session',parentExternalId:'parent-first',parentEntityKind:'meeting'})],26));
  await execute(result([item('child-parent-first',{},2026,{entityKind:'session',parentExternalId:'parent-first',parentEntityKind:'meeting'})],27));
  assert.equal(Number((await scalar("select count(*) count from provider_source_entities where external_id='child-parent-first'")).count),1);
  await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values('56c00000-0000-0000-0000-000000000098',$1,$2,'meeting','foreign-parent',2026,'{}','foreign',now(),now(),now())`,[providerId2,linkId2]);
  await execute(result([item('cross-scope-child',{},2026,{entityKind:'session',parentExternalId:'foreign-parent',parentEntityKind:'meeting'})],28));
  assert.equal((await scalar("select parent_source_entity_id from provider_source_entities where external_id='cross-scope-child'")).parent_source_entity_id,null);
  console.log('Références parent durables, typées, même périmètre et rejeu idempotent : OK');

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
  assert.equal((await scalar("select status from provider_acquisition_traversals where safe_unit_key='db-error'")).status,'failed');
  console.log('Erreur PostgreSQL : transaction annulée sans donnée partielle : OK');
  console.log('Tests PostgreSQL Lot 5.6-C : OK');
} finally { await pool.end(); }
