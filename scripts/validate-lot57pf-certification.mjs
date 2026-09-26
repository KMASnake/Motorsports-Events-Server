import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {pool} from '../apps/api/dist/lib/db.js';
import {PostgresDeterministicNormalizationService} from '../apps/api/dist/normalization/postgresDeterministicNormalizationService.js';
import {PostgresPublicationService} from '../apps/api/dist/normalization/postgresPublicationService.js';
import {previewReadRoutes} from '../apps/api/dist/routes/previewRead.js';

const sourceId='57000000-0000-4000-8000-000000000603';
const resourceId='57000000-0000-4000-8000-000000000610';
const scopeKey='f1:certification';
const mapping={version:'f1-preview-v1',rulesVersion:'rules-v1',championshipIds:{'fixture-f1':'f1'},circuitIds:{silverstone:'silverstone'},sessionTypes:{Race:'race'},statuses:{Scheduled:'scheduled',Cancelled:'cancelled',Postponed:'postponed',Finished:'completed'}};
const normalize=new PostgresDeterministicNormalizationService();
const publish=new PostgresPublicationService();
const app=Fastify({logger:false});
await app.register(previewReadRoutes,{cursorSecret:'lot-5-7-p-f-controlled-cursor-secret',now:()=>new Date('2026-07-06T00:00:00Z')});

const normalizeAndPublish=async at=>{
  const candidate=await normalize.normalizeUnit({sourceEntityId:sourceId,scopeKey,expectedFenceGeneration:11,normalizationNow:at,mapping});
  const publication=await publish.publishCandidate({candidateId:candidate.candidateId,scopeKey,expectedFenceGeneration:11,occurredAt:at});
  return {candidate,publication};
};
const updateSource=async(hash,patch,at)=>pool.query(`update provider_source_entities set source_data=source_data||$1::jsonb,source_hash=$2,last_changed_at=$3,last_observed_at=$3 where id=$4`,[JSON.stringify(patch),hash,at,sourceId]);
const get=async url=>{const response=await app.inject(url);assert.equal(response.statusCode,200,`${url}: ${response.body}`);return response.json();};

try{
  const first=await normalizeAndPublish(new Date('2026-07-01T00:00:00Z'));
  assert.equal(first.candidate.resolution.decision,'linked');
  assert.deepEqual(first.publication,{outcome:'created',revision:1,sequence:1});
  const replay=await normalizeAndPublish(new Date('2026-07-01T00:00:00Z'));
  assert.equal(replay.candidate.candidateId,first.candidate.candidateId);
  assert.deepEqual(replay.publication,first.publication);

  const snapshot=await get('/api/v1/events?championship_id=f1&from=2026-01-01T00:00:00Z');
  assert.equal(snapshot.data[0].id,resourceId);
  assert.equal(snapshot.data[0].starts_at,'2026-07-05T14:00:00.000Z');

  await updateSource('f1-replay-2',{starts_at:'2026-07-05T16:00:00+01:00'},new Date('2026-07-02T00:00:00Z'));
  const changed=await normalizeAndPublish(new Date('2026-07-02T00:00:00Z'));
  assert.equal(changed.publication.outcome,'updated');
  assert.equal(changed.publication.revision,2);
  assert.equal(changed.publication.sequence,2);
  const changes=await get(`/api/v1/changes?cursor=${snapshot.pagination.sync_cursor}&include=data`);
  assert.equal(changes.data.length,1);
  assert.equal(changes.data[0].resource_id,resourceId);
  assert.equal(changes.data[0].operation,'updated');
  assert.equal(changes.data[0].current.starts_at,'2026-07-05T15:00:00.000Z');

  await pool.query(`insert into provider_source_corrections(id,source_entity_id,field_path,override_value,source_value_at_creation,origin,actor_id,status) values('57000000-0000-4000-8000-000000000604',$1,'starts_at','"2026-07-05T17:00:00+01:00"','"2026-07-05T16:00:00+01:00"','administrator','f-certification','active')`,[sourceId]);
  await updateSource('f1-replay-3',{starts_at:'2026-07-05T18:00:00+01:00'},new Date('2026-07-03T00:00:00Z'));
  const corrected=await normalizeAndPublish(new Date('2026-07-03T00:00:00Z'));
  assert.equal(corrected.candidate.state.startsAt,'2026-07-05T16:00:00.000Z');
  await updateSource('f1-replay-4',{starts_at:'2026-07-05T19:00:00+01:00'},new Date('2026-07-04T00:00:00Z'));
  const correctionReplay=await normalizeAndPublish(new Date('2026-07-04T00:00:00Z'));
  assert.equal(correctionReplay.candidate.state.startsAt,'2026-07-05T16:00:00.000Z');
  assert.equal(correctionReplay.publication.outcome,'unchanged');

  await publish.setKillSwitch(false,new Date('2026-07-04T01:00:00Z'));
  await updateSource('f1-replay-5',{name:'Blocked provider rename'},new Date('2026-07-04T01:00:00Z'));
  const blocked=await normalizeAndPublish(new Date('2026-07-04T01:00:00Z'));
  assert.equal(blocked.publication.outcome,'kill_switch');
  assert.equal((await get(`/api/v1/events/${resourceId}`)).name,'British Grand Prix');
  await publish.setKillSwitch(true,new Date('2026-07-04T02:00:00Z'));

  await updateSource('f1-replay-6',{name:'British Grand Prix',status:'Cancelled'},new Date('2026-07-05T00:00:00Z'));
  const cancelled=await normalizeAndPublish(new Date('2026-07-05T00:00:00Z'));
  assert.equal(cancelled.publication.outcome,'updated');
  const cancelledResource=await get(`/api/v1/events/${resourceId}`);
  assert.equal(cancelledResource.status,'cancelled');
  const finalRows=(await pool.query('select revision::int,lifecycle from public_resource_states where resource_id=$1',[resourceId])).rows;
  assert.deepEqual(finalRows,[{revision:4,lifecycle:'active'}]);
  const sequences=(await pool.query('select sequence from public_change_log order by sequence')).rows.map(row=>Number(row.sequence));
  assert.deepEqual(sequences,[1,2,3,4]);
  assert.equal(Number((await pool.query('select count(*) from event_source_links where source_entity_id=$1',[sourceId])).rows[0].count),1);
  assert.equal(JSON.stringify(cancelledResource).includes('provider'),false);
  console.log('Lot 5.7-P-F acquisition replay -> normalization -> publication -> API -> changes: PASS');
}finally{
  await app.close();
  await pool.end();
}
