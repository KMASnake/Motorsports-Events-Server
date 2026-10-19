// Acquisition-only legacy fixtures do not execute canonical handoff. Their separate
// synthetic scenarios must explicitly dispose pending work before replacing it.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../../apps/api/dist/lib/db.js';
import {CanonicalAcquisitionPublicationService} from '../../apps/api/dist/normalization/canonicalAcquisitionPublicationService.js';
import {readHandoffEnvelope,protectedHandoff} from '../../apps/api/dist/providers/canonicalHandoffState.js';
export async function disposeFixtureHandoff(linkId){
  const provider=(await pool.query('select p.adapter_key from provider_instances p join provider_championships pc on pc.provider_instance_id=p.id where pc.id=$1',[linkId])).rows[0];
  assert.ok(provider?.adapter_key.startsWith('lot56-'),'synthetic acquisition-only adapter required');
  const service=new CanonicalAcquisitionPublicationService();
  for(const stream of (await pool.query('select historical_state from sync_streams where provider_championship_id=$1',[linkId])).rows){
    for(const [traversalId,entry] of Object.entries(readHandoffEnvelope(stream.historical_state).traversals)){
      if(protectedHandoff(entry.state))await service.resolveHandoff({traversalId,action:'abandon',actor:'lot56-regression-fixture',requestId:randomUUID(),expectedAttempts:entry.attempts,reason:'Explicit disposal between independent acquisition-only synthetic scenarios; no canonical success claimed'});
    }
  }
}

export async function fixtureTraversalMapping(linkId){
  const row=(await pool.query('select pc.championship_id,pc.external_championship_id,p.adapter_key from provider_championships pc join provider_instances p on p.id=pc.provider_instance_id where pc.id=$1',[linkId])).rows[0];
  assert.ok(row?.adapter_key.startsWith('lot56-'),'synthetic acquisition-only adapter required');
  const {PostgresNormalizationMappingRepository}=await import('../../apps/api/dist/normalization/postgresNormalizationMappingRepository.js');
  const repository=new PostgresNormalizationMappingRepository(),existing=await repository.getActiveMapping(linkId);
  if(existing)return existing.id;
  return (await repository.createAndActivateMappingVersion({providerChampionshipId:linkId,versionLabel:'lot56-synthetic-binding',rulesVersion:'lot56-synthetic-binding',actor:'lot56-regression-fixture',mappingDocument:{championshipIds:{[row.external_championship_id]:row.championship_id},circuitIds:{},sessionTypes:{},statuses:{}}})).id;
}
