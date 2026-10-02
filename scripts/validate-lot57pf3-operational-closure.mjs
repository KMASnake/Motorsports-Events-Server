import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {pool} from '../apps/api/dist/lib/db.js';
import {AcquisitionTransactionService} from '../apps/api/dist/providers/acquisitionTransactionService.js';
import {PersistentSchedulerService} from '../apps/api/dist/providers/schedulerService.js';
import {CanonicalAcquisitionPublicationService} from '../apps/api/dist/normalization/canonicalAcquisitionPublicationService.js';
import {previewReadRoutes} from '../apps/api/dist/routes/previewRead.js';

const ids={
  provider:'57000000-0000-4000-8000-00000000f301',championship:'57000000-0000-4000-8000-00000000f302',
  stream:'57000000-0000-4000-8000-00000000f303',mapping:'57000000-0000-4000-8000-00000000f304'
};
const meetingExternal='f3-grand-prix',eventExternal='f3-race';
const timeA='2026-09-13T13:00:00.000Z',timeB='2026-09-13T14:00:00.000Z';
const clock={now:()=>new Date('2026-08-28T12:00:00.000Z')};
const scheduler=new PersistentSchedulerService(clock);
const acquisition=new AcquisitionTransactionService(scheduler,clock);
const handoff=new CanonicalAcquisitionPublicationService();
const app=Fastify({logger:false});
await app.register(previewReadRoutes,{cursorSecret:'f3-certification-only-cursor-secret',now:clock.now});

let blockedNetworkAttempts=0;
const fixtureTransport={
  receive(items){return structuredClone(items);},
  async request(){blockedNetworkAttempts+=1;throw Object.assign(new Error('external_provider_network_blocked'),{code:'external_provider_network_blocked'});}
};
globalThis.fetch=async()=>fixtureTransport.request();

const itemSet=(startsAt,eventName)=>[
  {entityKind:'meeting',externalId:meetingExternal,identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'F3 Certification Grand Prix',session_type:'Race',status:'Scheduled',championship_id:'fixture-f1',circuit_id:'silverstone',starts_at:'2026-09-11T10:00:00.000Z',ends_at:'2026-09-13T16:00:00.000Z',timezone:'UTC'}},
  {entityKind:'event',externalId:eventExternal,identityIsSynthetic:false,parentExternalId:meetingExternal,parentEntityKind:'meeting',season:2026,sourceData:{name:eventName,session_type:'Race',status:'Scheduled',championship_id:'fixture-f1',circuit_id:'silverstone',starts_at:startsAt,ends_at:'2026-09-13T16:00:00.000Z',timezone:'UTC',parent_position:0}}
];

function adapter(items){return {
  key:'f3-fixture',capabilities:{supportsChampionshipDiscovery:false,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:false},providerConfigVersion:1,sourceConfigVersion:1,cursorVersion:1,
  providerForm:()=>[],championshipForm:()=>[],validateProviderConfig:value=>value,validateSourceConfig:value=>value,
  initialCursor:()=>({cycle:0}),validateCursor:value=>value,serializeCursor:value=>value,restoreCursor:value=>value,
  fetchWorkUnit:async()=>({status:'complete',items:fixtureTransport.receive(items),itemAnomalies:[],nextCursor:{cycle:1},requestCount:0,complete:true,completionReason:'end_of_collection'}),
  normalize:()=>({accepted:[],rejected:[]}),confirmEmptySeason:async()=>({confirmedEmpty:false,reason:'not-empty'})
};}

async function acquireCycle(label,items){
  const lease=await scheduler.acquire(`f3-certification-${label}`,{streamId:ids.stream});
  assert.ok(lease,`${label}: lease unavailable`);
  const result=await acquisition.executeUnit({
    providerInstanceId:ids.provider,providerChampionshipId:ids.championship,season:2026,workClass:'current_global',safeUnitKey:`current_global:2026:${label}`,
    lease:{streamId:ids.stream,runId:lease.run_id,workerId:`f3-certification-${label}`,generation:lease.lease_generation},adapter:adapter(items),
    fetchInput:{providerInstanceId:ids.provider,providerChampionshipId:ids.championship,championshipId:'f1',providerConfig:{},credentials:{},sourceConfig:{},phase:'current',season:2026,cursor:{cycle:0},signal:new AbortController().signal},mappingVersionId:ids.mapping
  });
  assert.equal(result.result.requestCount,0);
  assert.equal(result.result.complete,true);
  const publication=await handoff.handoffTraversal(result.traversalId);
  return {traversalId:result.traversalId,publication};
}

const get=async url=>{const response=await app.inject(url);assert.equal(response.statusCode,200,`${url}: ${response.body}`);return response.json();};
const eventState=async()=>{
  const row=(await pool.query(`select state.resource_id,state.revision::int,state.canonical_state,link.event_id,relation.meeting_id
    from provider_source_entities source join event_source_links link on link.source_entity_id=source.id
    join public_resource_states state on state.resource_type='event' and state.resource_id::uuid=link.normalized_event_uuid
    left join meeting_events relation on relation.event_id=link.event_id
    where source.provider_championship_id=$1 and source.entity_kind='event' and source.external_id=$2`,[ids.championship,eventExternal])).rows[0];
  assert.ok(row);return row;
};
const maxSequence=async()=>Number((await pool.query('select coalesce(max(sequence),0) value from public_change_log')).rows[0].value);
const changeCount=async()=>Number((await pool.query('select count(*) value from public_change_log')).rows[0].value);

try{
  await assert.rejects(()=>fixtureTransport.request(),/external_provider_network_blocked/);
  assert.equal(blockedNetworkAttempts,1);

  const cycleA=await acquireCycle('a',itemSet(timeA,'Race'));
  assert.equal(cycleA.publication.entities_seen,2);
  if(cycleA.publication.publications_created!==2){
    const diagnostic=(await pool.query(`select resource_kind,candidate_data->'resolution' resolution from normalized_candidates order by resource_kind`)).rows;
    assert.equal(cycleA.publication.publications_created,2,JSON.stringify({publication:cycleA.publication,diagnostic}));
  }
  const stateA=await eventState();
  const uuidA=String(stateA.resource_id),meetingA=String(stateA.meeting_id),revisionA=stateA.revision,sequenceA=await maxSequence(),changesA=await changeCount();
  assert.equal(stateA.canonical_state.startsAt,timeA);
  assert.equal(stateA.canonical_state.sessionType,'race');
  const snapshot=await get('/api/v1/events?championship_id=f1&from=2026-01-01T00:00:00Z');
  assert.equal(snapshot.data.length,1);assert.equal(snapshot.data[0].id,uuidA);
  const cursorA=snapshot.pagination.sync_cursor;assert.ok(cursorA);

  const sourceId=(await pool.query(`select id from provider_source_entities where provider_championship_id=$1 and entity_kind='event' and external_id=$2`,[ids.championship,eventExternal])).rows[0].id;
  await pool.query(`insert into provider_source_corrections(id,source_entity_id,field_path,override_value,source_value_at_creation,origin,actor_id,status)
    values('57000000-0000-4000-8000-00000000f305',$1,'name','"Administrator Race Label"','"Race"','administrator','f3-certification','active')`,[sourceId]);

  const cycleB=await acquireCycle('b',itemSet(timeB,'Provider Renamed Race'));
  assert.equal(cycleB.publication.publications_created,1);
  assert.equal(cycleB.publication.publications_unchanged,1);
  const stateB=await eventState(),sequenceB=await maxSequence(),changesB=await changeCount();
  assert.equal(String(stateB.resource_id),uuidA);assert.equal(String(stateB.meeting_id),meetingA);
  assert.equal(stateB.canonical_state.startsAt,timeB);assert.equal(stateB.canonical_state.name,'Administrator Race Label');assert.equal(stateB.canonical_state.sessionType,'race');
  assert.equal(stateB.revision,revisionA+1);assert.equal(sequenceB,sequenceA+1);assert.equal(changesB,changesA+1);
  const incremental=await get(`/api/v1/changes?cursor=${encodeURIComponent(cursorA)}&include=data`);
  assert.equal(incremental.data.length,1);assert.equal(incremental.data[0].resource_id,uuidA);assert.equal(incremental.data[0].operation,'updated');
  assert.deepEqual(incremental.data[0].changed_fields,['name','startsAt']);
  assert.equal(incremental.data[0].current.starts_at,timeB);assert.equal(incremental.data[0].current.name,'Administrator Race Label');
  assert.equal(Number((await pool.query('select count(*) value from event_source_links where event_id=$1',[stateB.event_id])).rows[0].value),1);
  assert.equal(Number((await pool.query('select count(*) value from meeting_events where event_id=$1 and meeting_id=$2',[stateB.event_id,meetingA])).rows[0].value),1);
  assert.equal(Number((await pool.query(`select count(*) value from events event left join meeting_events relation on relation.event_id=event.id where event.normalized_uuid is not null and relation.meeting_id is null`)).rows[0].value),0);

  const replayB=await acquireCycle('b-replay',itemSet(timeB,'Provider Renamed Race'));
  assert.equal(replayB.publication.publications_created,0);assert.equal(replayB.publication.publications_unchanged,2);
  const stateReplay=await eventState();
  assert.equal(String(stateReplay.resource_id),uuidA);assert.equal(stateReplay.revision,stateB.revision);
  assert.equal(await maxSequence(),sequenceB);assert.equal(await changeCount(),changesB);
  assert.equal(blockedNetworkAttempts,1);
  console.log(JSON.stringify({status:'PASS',criteria:['PP-T36','PP-163','PP-174'],cycles:3,provider_calls:0,blocked_network_attempts:blockedNetworkAttempts,worker_started:false,uuid_stable:true,revision_before:revisionA,revision_after:stateB.revision,sequence_before:sequenceA,sequence_after:sequenceB,changes_after_cursor:1,expected_changed_fields:['name','startsAt'],source_b_starts_at_published:true,administrative_name_override_preserved:true,orphan_events:0,wrong_parent:0}));
}finally{await app.close();await pool.end();}
