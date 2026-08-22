import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {canonicalPublicState,changedPublicFields,publicationQuality,publicStateChecksum,type PublicResourceType} from './publicationState.js';

interface PublishInput{candidateId:string;expectedFenceGeneration?:number;scopeKey?:string;occurredAt:Date;failBeforeCommit?:boolean}
interface RemoveInput{resourceType:PublicResourceType;resourceId:string;occurredAt:Date}

export class PostgresPublicationService{
  publishCandidate(input:PublishInput){return withTransaction(client=>this.publishCandidateInTransaction(client,input));}

  async publishCandidateInTransaction(client:PoolClient,input:PublishInput){
    const control=(await client.query("select enabled from publication_controls where control_key='promotion' for share")).rows[0];
    if(!control?.enabled)return {outcome:'kill_switch',revision:null,sequence:null};
    if(input.scopeKey&&input.expectedFenceGeneration!==undefined){
      const checkpoint=(await client.query('select fence_generation from normalization_checkpoints where scope_key=$1 for share',[input.scopeKey])).rows[0];
      if(!checkpoint||Number(checkpoint.fence_generation)!==input.expectedFenceGeneration)throw new Error('publication_checkpoint_stale');
    }
    const row=(await client.query(`select candidate.*,decision.decision,decision.target_id
      from normalized_candidates candidate join lateral(
        select decision,target_id from normalization_decisions where candidate_id=candidate.id order by decided_at desc,id desc limit 1
      ) decision on true where candidate.id=$1 for update of candidate`,[input.candidateId])).rows[0];
    if(!row)throw new Error('publication_candidate_not_found');
    const data=typeof row.candidate_data==='string'?JSON.parse(row.candidate_data):row.candidate_data;
    const normalized=data?.normalized as Readonly<Record<string,unknown>>|undefined;
    if(!normalized)throw new Error('publication_candidate_invalid');
    const quality=publicationQuality(normalized,String(row.decision));
    if(quality!=='ready')return {outcome:quality,revision:null,sequence:null};
    const resourceType=String(row.resource_kind) as 'event'|'meeting';
    let resourceId=String(data.proposed_uuid);
    if(row.decision==='linked'&&row.target_id){
      if(resourceType==='event'){
        const identity=(await client.query('select normalized_uuid from events where id=$1',[row.target_id])).rows[0];
        if(!identity?.normalized_uuid)throw new Error('publication_resource_identity_missing');
        resourceId=String(identity.normalized_uuid);
      }else resourceId=String(row.target_id);
    }
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resourceId))throw new Error('publication_resource_uuid_invalid');
    const state=canonicalPublicState(normalized),checksum=publicStateChecksum(state);
    const receipt=(await client.query('select * from publication_receipts where candidate_id=$1',[input.candidateId])).rows[0];
    if(receipt)return {outcome:String(receipt.outcome),revision:Number(receipt.resource_revision),sequence:receipt.change_sequence==null?null:Number(receipt.change_sequence)};
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${resourceType}:${resourceId}`]);
    const current=(await client.query('select * from public_resource_states where resource_type=$1 and resource_id=$2 for update',[resourceType,resourceId])).rows[0];
    if(current?.lifecycle==='removed')throw new Error('publication_tombstone_permanent');
    if(current?.state_checksum===checksum){
      await client.query(`insert into publication_receipts(candidate_id,resource_type,resource_id,effective_checksum,resource_revision,change_sequence,outcome,committed_at)
        values($1,$2,$3,$4,$5,null,'unchanged',$6)`,[input.candidateId,resourceType,resourceId,checksum,current.revision,input.occurredAt]);
      await client.query("update normalized_candidates set state='promoted',updated_at=$2 where id=$1",[input.candidateId,input.occurredAt]);
      return {outcome:'unchanged',revision:Number(current.revision),sequence:null};
    }
    const revision=current?Number(current.revision)+1:1,operation=current?'updated':'created',changed=changedPublicFields(current?.canonical_state??null,state);
    await client.query(`insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_candidate_id,promoted_at)
      values($1,$2,$3,$4,'active',$5::jsonb,$6,$7,$8)
      on conflict(resource_type,resource_id) do update set championship_id=excluded.championship_id,revision=excluded.revision,canonical_state=excluded.canonical_state,state_checksum=excluded.state_checksum,promoted_candidate_id=excluded.promoted_candidate_id,promoted_at=excluded.promoted_at`,[resourceType,resourceId,state.championshipId??null,revision,JSON.stringify(state),checksum,input.candidateId,input.occurredAt]);
    const change=(await client.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at)
      values($1,$2,$3,$4,$5,$6,$7) returning sequence`,[resourceType,resourceId,revision,operation,changed,checksum,input.occurredAt])).rows[0];
    await client.query(`insert into publication_receipts(candidate_id,resource_type,resource_id,effective_checksum,resource_revision,change_sequence,outcome,committed_at)
      values($1,$2,$3,$4,$5,$6,$7,$8)`,[input.candidateId,resourceType,resourceId,checksum,revision,change.sequence,operation,input.occurredAt]);
    await client.query("update normalized_candidates set state='promoted',updated_at=$2 where id=$1",[input.candidateId,input.occurredAt]);
    if(input.failBeforeCommit)throw new Error('publication_injected_failure');
    return {outcome:operation,revision,sequence:Number(change.sequence)};
  }

  removeResource(input:RemoveInput){return withTransaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.resourceType}:${input.resourceId}`]);
    const current=(await client.query('select * from public_resource_states where resource_type=$1 and resource_id=$2 for update',[input.resourceType,input.resourceId])).rows[0];
    if(!current)throw new Error('publication_resource_not_found');
    if(current.lifecycle==='removed')return {outcome:'unchanged',revision:Number(current.revision),sequence:null};
    const revision=Number(current.revision)+1,checksum=publicStateChecksum({removed:true});
    await client.query(`update public_resource_states set revision=$3,lifecycle='removed',canonical_state=null,state_checksum=$4,removed_at=$5,promoted_at=$5 where resource_type=$1 and resource_id=$2`,[input.resourceType,input.resourceId,revision,checksum,input.occurredAt]);
    const change=(await client.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values($1,$2,$3,'removed','{}',$4,$5) returning sequence`,[input.resourceType,input.resourceId,revision,checksum,input.occurredAt])).rows[0];
    return {outcome:'removed',revision,sequence:Number(change.sequence)};
  });}

  setKillSwitch(enabled:boolean,occurredAt:Date){return withTransaction(async client=>(await client.query(`update publication_controls set enabled=$1,revision=revision+1,updated_at=$2 where control_key='promotion' returning *`,[enabled,occurredAt])).rows[0]);}

  rebuildIncremental(scopeKey:string,occurredAt:Date){return withTransaction(async client=>{
    const checkpoint=(await client.query('select * from publication_rebuild_checkpoints where scope_key=$1 for update',[scopeKey])).rows[0];
    const candidates=(await client.query(`select id from normalized_candidates where state in ('pending','promoted') and ($1::uuid is null or id>$1) order by id`,[checkpoint?.last_candidate_id??null])).rows;
    let last=checkpoint?.last_candidate_id??null;
    for(const candidate of candidates){await this.publishCandidateInTransaction(client,{candidateId:String(candidate.id),occurredAt});last=candidate.id;}
    if(last)await client.query(`insert into publication_rebuild_checkpoints(scope_key,last_candidate_id) values($1,$2) on conflict(scope_key) do update set last_candidate_id=excluded.last_candidate_id,revision=publication_rebuild_checkpoints.revision+1,updated_at=$3`,[scopeKey,last,occurredAt]);
    return {processed:candidates.length,lastCandidateId:last};
  });}

  rebuildFromScratch(scopeKey:string,occurredAt:Date){return withTransaction(async client=>{
    await client.query('delete from publication_rebuild_checkpoints where scope_key=$1',[scopeKey]);
    const candidates=(await client.query(`select id from normalized_candidates where state in ('pending','promoted') order by id`)).rows;
    for(const candidate of candidates)await this.publishCandidateInTransaction(client,{candidateId:String(candidate.id),occurredAt});
    const last=candidates.at(-1)?.id??null;
    if(last)await client.query('insert into publication_rebuild_checkpoints(scope_key,last_candidate_id) values($1,$2)',[scopeKey,last]);
    return {processed:candidates.length,lastCandidateId:last};
  });}
}
