import assert from 'node:assert/strict';
import {PostgresPublicationService} from '../apps/api/dist/normalization/postgresPublicationService.js';
import {pool} from '../apps/api/dist/lib/db.js';

const service=new PostgresPublicationService(),at=new Date('2026-08-22T12:00:00Z');
const ids={first:'57000000-0000-4000-8000-000000000201',same:'57000000-0000-4000-8000-000000000202',changed:'57000000-0000-4000-8000-000000000203',review:'57000000-0000-4000-8000-000000000204',cancelled:'57000000-0000-4000-8000-000000000205'};
try{
  const [first,concurrentReplay]=await Promise.all([
    service.publishCandidate({candidateId:ids.first,scopeKey:'f1:event-normalization',expectedFenceGeneration:7,occurredAt:at}),
    service.publishCandidate({candidateId:ids.first,scopeKey:'f1:event-normalization',expectedFenceGeneration:7,occurredAt:at})
  ]);
  assert.deepEqual(first,{outcome:'created',revision:1,sequence:1});
  assert.deepEqual(concurrentReplay,first);
  assert.deepEqual(await service.publishCandidate({candidateId:ids.first,occurredAt:at}),first);
  const same=await service.publishCandidate({candidateId:ids.same,occurredAt:at});assert.equal(same.outcome,'unchanged');assert.equal(same.sequence,null);
  const changed=await service.publishCandidate({candidateId:ids.changed,occurredAt:at});assert.equal(changed.outcome,'updated');assert.equal(changed.revision,2);
  const review=await service.publishCandidate({candidateId:ids.review,occurredAt:at});assert.equal(review.outcome,'review_required');
  assert.equal(Number((await pool.query("select count(*) from public_resource_states where resource_id='57000000-0000-4000-8000-000000000299'")).rows[0].count),0);
  await assert.rejects(service.publishCandidate({candidateId:ids.cancelled,occurredAt:at,failBeforeCommit:true}),/publication_injected_failure/);
  assert.equal(Number((await pool.query('select revision from public_resource_states where resource_id=$1',['57000000-0000-4000-8000-000000000210'])).rows[0].revision),2);
  const cancelled=await service.publishCandidate({candidateId:ids.cancelled,occurredAt:at});assert.equal(cancelled.outcome,'updated');
  const beforeKill=Number((await pool.query('select count(*) from public_change_log')).rows[0].count);
  await service.setKillSwitch(false,at);assert.equal((await service.publishCandidate({candidateId:ids.changed,occurredAt:at})).outcome,'kill_switch');
  assert.equal(Number((await pool.query('select count(*) from public_change_log')).rows[0].count),beforeKill);await service.setKillSwitch(true,at);
  const removed=await service.removeResource({resourceType:'event',resourceId:'57000000-0000-4000-8000-000000000210',occurredAt:at});assert.equal(removed.outcome,'removed');
  await service.publishCandidate({candidateId:ids.cancelled,occurredAt:at});
  const tombstone=(await pool.query('select lifecycle,canonical_state from public_resource_states where resource_id=$1',['57000000-0000-4000-8000-000000000210'])).rows[0];
  assert.equal(tombstone.lifecycle,'removed');assert.equal(tombstone.canonical_state,null);
  const sequences=(await pool.query('select sequence from public_change_log order by sequence')).rows.map(row=>Number(row.sequence));assert.deepEqual(sequences,[...sequences].sort((a,b)=>a-b));assert.equal(new Set(sequences).size,sequences.length);
  const before=JSON.stringify((await pool.query('select resource_type,resource_id,revision,lifecycle,canonical_state from public_resource_states order by 1,2')).rows);
  await service.rebuildFromScratch('proof-from-scratch',at);await service.rebuildIncremental('proof-from-scratch',at);
  const after=JSON.stringify((await pool.query('select resource_type,resource_id,revision,lifecycle,canonical_state from public_resource_states order by 1,2')).rows);assert.equal(after,before);
  console.log('Lot 5.7-P-C PostgreSQL publication: PASS');
}finally{await pool.end();}
