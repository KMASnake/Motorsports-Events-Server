import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {pool} from '../apps/api/dist/lib/db.js';
import {CanonicalAcquisitionPublicationService,CanonicalHandoffError} from '../apps/api/dist/normalization/canonicalAcquisitionPublicationService.js';
import {PostgresPublicationService} from '../apps/api/dist/normalization/postgresPublicationService.js';
import {previewReadRoutes} from '../apps/api/dist/routes/previewRead.js';
const complete='57000000-0000-4000-8000-000000003204',incomplete='57000000-0000-4000-8000-000000003205',unbound='57000000-0000-4000-8000-000000003206',empty='57000000-0000-4000-8000-000000003207';
const source='57000000-0000-4000-8000-000000003208',oldMapping='57000000-0000-4000-8000-000000003209';
const service=new CanonicalAcquisitionPublicationService();
const fails=async(id,code)=>assert.rejects(()=>service.handoffTraversal(id),error=>error instanceof CanonicalHandoffError&&error.code===code);
const app=Fastify({logger:false});await app.register(previewReadRoutes,{cursorSecret:'canonical-handoff-fixture-secret'});
try{
  await fails(incomplete,'traversal_ineligible');await fails(unbound,'traversal_unbound');
  const emptyResult=await service.handoffTraversal(empty);assert.equal(emptyResult.status,'no_changes');assert.equal(emptyResult.entities_seen,0);
  const injected=new CanonicalAcquisitionPublicationService(undefined,undefined,{publishCandidateInTransaction:async()=>{throw new Error('after-normalization');}});
  await assert.rejects(()=>injected.handoffTraversal(complete),/after-normalization/);assert.equal(Number((await pool.query('select count(*) count from normalized_candidates')).rows[0].count),0);
  const first=await service.handoffTraversal(complete);assert.equal(first.mapping_version_id,oldMapping);assert.equal(first.publications_created,1);assert.equal(first.highest_change_sequence,1);
  const replay=await service.handoffTraversal(complete);assert.equal(replay.publications_created,0);assert.equal(replay.publications_unchanged,1);assert.equal(Number((await pool.query('select count(*) count from public_change_log')).rows[0].count),1);
  try{await service.handoffTraversal(complete);throw new Error('caller-lost-response');}catch(error){assert.match(String(error),/caller-lost-response/);}
  const recovered=await service.handoffTraversal(complete);assert.equal(recovered.publications_unchanged,1);assert.equal(Number((await pool.query('select count(*) count from public_change_log')).rows[0].count),1);
  const concurrent=await Promise.all([service.handoffTraversal(complete),service.handoffTraversal(complete)]);assert.equal(concurrent.every(item=>item.publications_created===0),true);assert.equal(Number((await pool.query('select count(*) count from public_change_log')).rows[0].count),1);
  const changedTraversal='57000000-0000-4000-8000-000000003220';
  await pool.query(`insert into provider_acquisition_traversals(id,stream_id,work_class,safe_unit_key,status,complete,finished_at,lease_generation) values($1,'57000000-0000-4000-8000-000000003203','current_hot','complete-2','complete',true,now(),2)`,[changedTraversal]);
  await pool.query(`update provider_source_entities set source_data=jsonb_set(source_data,'{starts_at}','"2026-07-05T15:00:00Z"'),source_hash='handoff-2',last_observed_at=now(),last_changed_at=now(),last_traversal_id=$2 where id=$1`,[source,changedTraversal]);
  await pool.query(`insert into provider_source_observations values($1,$2,'present',now())`,[changedTraversal,source]);
  await pool.query(`insert into provider_acquisition_traversal_mappings values($1,'57000000-0000-4000-8000-000000003202',$2,now())`,[changedTraversal,oldMapping]);
  const changed=await service.handoffTraversal(changedTraversal);assert.equal(changed.publications_created,1);assert.equal(changed.highest_change_sequence,2);assert.equal(Number((await pool.query('select count(*) count from public_change_log')).rows[0].count),2);
  const response=await app.inject('/api/v1/events?championship_id=f1&from=2026-01-01T00:00:00Z');assert.equal(response.statusCode,200);assert.equal(response.json().data.length,1);
  const changes=await app.inject('/api/v1/changes?include=data');assert.equal(changes.statusCode,200);assert.equal(changes.json().data.length,2);
  assert.equal(Number((await pool.query("select count(*) count from provider_source_entities where id<>$1 and last_traversal_id=$2",[source,complete])).rows[0].count),0);
  console.log('Canonical completed traversal -> persisted mapping -> normalization -> publication -> API -> changes: PASS');
}finally{await app.close();await pool.end();}
