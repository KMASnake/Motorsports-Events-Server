import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {PostgresNormalizationMappingRepository} from './postgresNormalizationMappingRepository.js';
import {PostgresDeterministicNormalizationService} from './postgresDeterministicNormalizationService.js';
import {PostgresPublicationService} from './postgresPublicationService.js';

export class CanonicalHandoffError extends Error{
  constructor(readonly code:'traversal_not_found'|'traversal_ineligible'|'traversal_stale'|'traversal_unbound'|'ownership_mismatch'|'stale_fence',message:string){super(message);}
}
export function canonicalNormalizationScope(providerChampionshipId:string,phase:'current'|'historical',mappingVersionId:string){return `provider-championship:${providerChampionshipId}:phase:${phase}:mapping:${mappingVersionId}`;}
export type CanonicalHandoffResult={traversal_id:string;provider_championship_id:string;mapping_version_id:string;normalization_scope:string;fence_generation:number;entities_seen:number;entities_normalized:number;candidates_ready:number;candidates_review:number;publications_created:number;publications_unchanged:number;highest_change_sequence:number|null;status:'completed'|'no_changes'|'review_required'|'rejected'};
export function finalCandidateClassification(decision:string,publicationOutcome?:string){if(decision==='review'||publicationOutcome==='review_required')return 'review';if(decision==='rejected')return 'rejected';if(['created','updated','unchanged'].includes(publicationOutcome??''))return 'ready';return 'deferred';}
export function finalHandoffStatus(entities:number,review:number,ready:number,rejected:number,created:number):CanonicalHandoffResult['status']{return entities===0?'no_changes':review>0?'review_required':ready===0&&rejected>0?'rejected':created===0?'no_changes':'completed';}

export class CanonicalAcquisitionPublicationService{
  constructor(readonly mappings=new PostgresNormalizationMappingRepository(),readonly normalization=new PostgresDeterministicNormalizationService(),readonly publication=new PostgresPublicationService()){}
  handoffTraversal(traversalId:string,now=new Date()){return withTransaction(client=>this.handoffInTransaction(client,traversalId,now));}
  private async handoffInTransaction(client:PoolClient,traversalId:string,now:Date):Promise<CanonicalHandoffResult>{
    const traversal=(await client.query(`select traversal.*,stream.phase,stream.provider_championship_id,stream.lease_owner,stream.lease_expires_at,run.status run_status
      from provider_acquisition_traversals traversal join sync_streams stream on stream.id=traversal.stream_id
      left join sync_runs run on run.id=traversal.run_id where traversal.id=$1 for update of traversal,stream`,[traversalId])).rows[0];
    if(!traversal)throw new CanonicalHandoffError('traversal_not_found','Acquisition traversal not found.');
    if(traversal.complete!==true||!['complete','empty_confirmed'].includes(String(traversal.status))||!traversal.finished_at)throw new CanonicalHandoffError('traversal_ineligible','Traversal is incomplete, partial or failed.');
    if(traversal.lease_owner||traversal.run_status==='running')throw new CanonicalHandoffError('traversal_ineligible','Acquisition is still active.');
    await client.query('select id from sync_streams where provider_championship_id=$1 order by id for update',[traversal.provider_championship_id]);
    const version=await this.mappings.getTraversalMapping(traversalId,client);if(!version)throw new CanonicalHandoffError('traversal_unbound','Traversal has no immutable mapping binding.');
    if(version.providerChampionshipId!==String(traversal.provider_championship_id))throw new CanonicalHandoffError('ownership_mismatch','Traversal mapping ownership is inconsistent.');
    const stale=(await client.query(`select 1 from provider_source_observations selected where selected.traversal_id=$1 and exists(select 1 from provider_source_observations newer where newer.source_entity_id=selected.source_entity_id and newer.observed_at>selected.observed_at) limit 1`,[traversalId])).rowCount;
    if(stale)throw new CanonicalHandoffError('traversal_stale','A newer observation already owns the current source state.');
    const mapping=await this.mappings.resolveTraversalMappingConfig(traversalId,client),phase=String(traversal.phase) as 'current'|'historical';
    const scope=canonicalNormalizationScope(String(traversal.provider_championship_id),phase,version.id);
    const checkpoint=(await client.query(`insert into normalization_checkpoints(scope_key,normalization_version,fence_generation) values($1,$2,1)
      on conflict(scope_key) do update set normalization_version=excluded.normalization_version,last_source_entity_id=null,last_source_changed_at=null,fence_generation=normalization_checkpoints.fence_generation+1,revision=normalization_checkpoints.revision+1,updated_at=now()
      returning fence_generation`,[scope,mapping.version])).rows[0],fence=Number(checkpoint.fence_generation);
    const entities=(await client.query(`select entity.id,observation.observation_kind from provider_source_observations observation
      join provider_source_entities entity on entity.id=observation.source_entity_id
      where observation.traversal_id=$1 and entity.provider_championship_id=$2
      order by entity.parent_source_entity_id nulls first,entity.last_changed_at,entity.id`,[traversalId,traversal.provider_championship_id])).rows;
    let normalized=0,ready=0,review=0,rejected=0,created=0,unchanged=0,highest:number|null=null;
    for(const entity of entities){
      const candidate=await this.normalization.normalizeUnitInTransaction(client,{sourceEntityId:String(entity.id),scopeKey:scope,expectedFenceGeneration:fence,normalizationNow:now,mapping,traversalId});normalized+=1;
      if(candidate.resolution.decision==='review'){review+=1;continue;}if(candidate.resolution.decision==='rejected'){rejected+=1;continue;}
      const receiptExists=Boolean((await client.query('select 1 from publication_receipts where candidate_id=$1',[candidate.candidateId])).rowCount);
      const published=await this.publication.publishCandidateInTransaction(client,{candidateId:candidate.candidateId,scopeKey:scope,expectedFenceGeneration:fence,occurredAt:now});
      const classification=finalCandidateClassification(candidate.resolution.decision,published.outcome);if(classification==='review'){review+=1;continue;}if(classification==='ready')ready+=1;
      if(receiptExists)unchanged+=1;else if(published.outcome==='created'||published.outcome==='updated'){created+=1;if(published.sequence!=null)highest=Math.max(highest??0,published.sequence);}else if(published.outcome==='unchanged')unchanged+=1;
    }
    const status=finalHandoffStatus(entities.length,review,ready,rejected,created);
    return {traversal_id:traversalId,provider_championship_id:String(traversal.provider_championship_id),mapping_version_id:version.id,normalization_scope:scope,fence_generation:fence,entities_seen:entities.length,entities_normalized:normalized,candidates_ready:ready,candidates_review:review,publications_created:created,publications_unchanged:unchanged,highest_change_sequence:highest,status};
  }
}
