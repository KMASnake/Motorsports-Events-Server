import assert from 'node:assert/strict';
import {PostgresDeterministicNormalizationService} from '../apps/api/dist/normalization/postgresDeterministicNormalizationService.js';
import {pool} from '../apps/api/dist/lib/db.js';

const service=new PostgresDeterministicNormalizationService();
const mapping={version:'f1-preview-v1',rulesVersion:'rules-v1',championshipIds:{'fixture-f1':'f1'},circuitIds:{silverstone:'silverstone'},sessionTypes:{Race:'race'},statuses:{Scheduled:'scheduled',Cancelled:'cancelled',Postponed:'postponed',Finished:'completed'}};
const request={sourceEntityId:'57000000-0000-4000-8000-000000000103',scopeKey:'f1:event-normalization',expectedFenceGeneration:7,normalizationNow:new Date('2026-07-06T00:00:00Z'),mapping};

try{
  const first=await service.normalizeUnit(request),replay=await service.normalizeUnit(request);
  assert.equal(first.resolution.decision,'linked');assert.equal(first.resolution.targetId,'evt-002');
  assert.equal(first.candidateId,replay.candidateId);assert.equal(first.decisionId,replay.decisionId);assert.equal(first.checkpointRevision,replay.checkpointRevision);
  assert.equal(first.state.name,'Corrected British Grand Prix');assert.equal(first.state.provenance.fields.name.origin,'correction');

  await pool.query(`update provider_source_entities set source_data=jsonb_set(source_data,'{name}','"Provider renamed"'),source_hash='hash-2',last_changed_at='2026-07-02T00:00:00Z' where id=$1`,[request.sourceEntityId]);
  const updated=await service.normalizeUnit(request);assert.equal(updated.resolution.targetId,'evt-002');assert.equal(updated.state.name,'Corrected British Grand Prix');

  await pool.query(`update provider_source_corrections set status='inactive',deactivated_at='2026-07-03T00:00:00Z' where source_entity_id=$1 and field_path='name'`,[request.sourceEntityId]);
  await pool.query(`update provider_source_entities set source_hash='hash-3',last_changed_at='2026-07-03T00:00:00Z' where id=$1`,[request.sourceEntityId]);
  const disabled=await service.normalizeUnit(request);assert.equal(disabled.state.name,'Provider renamed');assert.equal(disabled.resolution.targetId,'evt-002');

  await pool.query(`update provider_source_entities set source_hash='hash-stale',last_changed_at='2026-07-04T00:00:00Z' where id=$1`,[request.sourceEntityId]);
  await assert.rejects(service.normalizeUnit({...request,expectedFenceGeneration:8}),/normalization_checkpoint_stale/);
  assert.equal(Number((await pool.query(`select count(*) from normalized_candidates where source_hash='hash-stale'`)).rows[0].count),0);

  await Promise.all([service.normalizeUnit(request),service.normalizeUnit(request)]);
  const proof=(await pool.query(`select
    (select count(*) from event_source_links where source_entity_id=$1)::int links,
    (select count(*) from normalized_candidates where source_entity_id=$1)::int candidates,
    (select count(*) from normalization_decisions where source_entity_id=$1)::int decisions,
    (select revision from normalization_checkpoints where scope_key=$2)::int revision`,[request.sourceEntityId,request.scopeKey])).rows[0];
  assert.deepEqual({links:proof.links,candidates:proof.candidates,decisions:proof.decisions,revision:proof.revision},{links:1,candidates:4,decisions:4,revision:5});
  console.log('Lot 5.7-P-B PostgreSQL normalization: PASS');
}finally{await pool.end();}
