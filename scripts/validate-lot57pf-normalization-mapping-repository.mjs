import assert from 'node:assert/strict';
import {pool} from '../apps/api/dist/lib/db.js';
import {NormalizationMappingRepositoryError,PostgresNormalizationMappingRepository} from '../apps/api/dist/normalization/postgresNormalizationMappingRepository.js';

const repository=new PostgresNormalizationMappingRepository();
const owner='57000000-0000-4000-8000-000000003101',other='57000000-0000-4000-8000-000000003102';
const traversal='57000000-0000-4000-8000-000000003121',legacy='57000000-0000-4000-8000-000000003122';
const mappingDocument={championshipIds:{formula1:'f1'},circuitIds:{silverstone:'silverstone'},sessionTypes:{Race:'race'},statuses:{Scheduled:'scheduled'}};
const otherDocument={championshipIds:{formula2:'f1'},circuitIds:{},sessionTypes:{},statuses:{}};
const fails=async(operation,code)=>{await assert.rejects(operation,error=>error instanceof NormalizationMappingRepositoryError&&error.code===code);};

try{
  const first=await repository.createMappingVersion({providerChampionshipId:owner,versionLabel:'v1',rulesVersion:'rules-v1',mappingDocument,actor:'repository-test'});
  const second=await repository.createMappingVersion({providerChampionshipId:owner,versionLabel:'v2',rulesVersion:'rules-v2',mappingDocument,actor:'repository-test'});
  const foreign=await repository.createMappingVersion({providerChampionshipId:other,versionLabel:'v1',rulesVersion:'rules-v1',mappingDocument:otherDocument,actor:'repository-test'});
  assert.equal((await repository.listMappingVersions(owner)).length,2);
  assert.deepEqual(await repository.resolveMappingConfig(first.id),{version:`mapping:${first.id}`,rulesVersion:'rules-v1',...mappingDocument});
  await fails(()=>repository.resolveActiveMappingConfig(owner),'active_mapping_absent');
  await repository.activateMapping(owner,first.id,'activation-v1');
  assert.equal((await repository.getActiveMapping(owner))?.id,first.id);
  await fails(()=>repository.activateMapping(owner,foreign.id,'wrong-owner'),'ownership_mismatch');
  await Promise.all([repository.activateMapping(owner,first.id,'concurrent-v1'),repository.activateMapping(owner,second.id,'concurrent-v2')]);
  assert.ok([first.id,second.id].includes((await repository.getActiveMapping(owner))?.id??''));
  await repository.activateMapping(owner,first.id,'historical-v1');
  assert.equal((await repository.bindTraversalMapping(traversal,first.id)).id,first.id);
  assert.equal((await repository.bindTraversalMapping(traversal,first.id)).id,first.id);
  await fails(()=>repository.bindTraversalMapping(traversal,second.id),'binding_conflict');
  await fails(()=>repository.bindTraversalMapping(legacy,foreign.id),'ownership_mismatch');
  await repository.activateMapping(owner,second.id,'future-v2');
  assert.equal((await repository.resolveActiveMappingConfig(owner)).version,`mapping:${second.id}`);
  assert.equal((await repository.resolveTraversalMappingConfig(traversal)).version,`mapping:${first.id}`);
  await fails(()=>repository.resolveTraversalMappingConfig(legacy),'traversal_mapping_absent');
  assert.equal(Number((await pool.query('select count(*) count from provider_acquisition_traversal_mappings where traversal_id=$1',[legacy])).rows[0].count),0);
  console.log('PostgresNormalizationMappingRepository activation/binding/resolution/concurrency: PASS');
}finally{await pool.end();}
