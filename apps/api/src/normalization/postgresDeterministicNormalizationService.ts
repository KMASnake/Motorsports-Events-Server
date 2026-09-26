import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {normalize,stableHash,stableUuid,type Correction,type MappingConfig,type MatchCandidate,type SourceEnvelope} from './deterministicNormalization.js';

interface NormalizeUnitInput {sourceEntityId:string;scopeKey:string;expectedFenceGeneration:number;normalizationNow:Date;mapping:MappingConfig;traversalId?:string}

export class PostgresDeterministicNormalizationService{
  normalizeUnit(input:NormalizeUnitInput){return withTransaction(client=>this.normalizeUnitInTransaction(client,input));}

  async normalizeUnitInTransaction(client:PoolClient,input:NormalizeUnitInput){
    const source=(await client.query(`select entity.*,provider.adapter_key,
      championship.external_championship_id championship_source_id,
      observation.observation_kind,last_traversal.complete traversal_complete
      from provider_source_entities entity
      join provider_instances provider on provider.id=entity.provider_instance_id
      join provider_championships championship on championship.id=entity.provider_championship_id
      left join provider_acquisition_traversals last_traversal on last_traversal.id=coalesce($2::uuid,entity.last_traversal_id)
      left join provider_source_observations observation on observation.traversal_id=coalesce($2::uuid,entity.last_traversal_id) and observation.source_entity_id=entity.id
      where entity.id=$1 for update of entity`,[input.sourceEntityId,input.traversalId??null])).rows[0];
    if(!source)throw new Error('normalization_source_not_found');
    const correctionRows=(await client.query(`select id,field_path,override_value,status from provider_source_corrections
      where source_entity_id=$1 order by field_path,id`,[input.sourceEntityId])).rows;
    const corrections:Correction[]=correctionRows.map(row=>({id:String(row.id),fieldPath:String(row.field_path),value:row.override_value,active:row.status==='active'}));
    const envelope:SourceEnvelope={id:String(source.id),kind:source.entity_kind==='meeting'?'meeting':'event',sourceHash:String(source.source_hash),providerKey:String(source.adapter_key),championshipSourceId:String(source.championship_source_id),season:source.season==null?null:Number(source.season),data:source.source_data,corrections,lastChangedAt:new Date(source.last_changed_at).toISOString(),lastObservedAt:new Date(source.last_observed_at).toISOString(),observation:source.observation_kind??undefined,traversalComplete:source.traversal_complete===true,providerStartedAt:source.provider_started_at?new Date(source.provider_started_at).toISOString():null,providerEndedAt:source.provider_ended_at?new Date(source.provider_ended_at).toISOString():null,theoreticalEndAt:source.theoretical_end_at?new Date(source.theoretical_end_at).toISOString():null,endEstimated:source.end_estimated===true,endProvenance:source.end_provenance??null,now:new Date(source.last_observed_at).toISOString()};
    envelope.now=input.normalizationNow.toISOString();
    const existing=envelope.kind==='meeting'
      ?(await client.query('select meeting_id target_id from meeting_source_links where source_entity_id=$1',[input.sourceEntityId])).rows[0]?.target_id??null
      :(await client.query('select event_id target_id from event_source_links where source_entity_id=$1',[input.sourceEntityId])).rows[0]?.target_id??null;
    const parentSourceRequired=envelope.kind==='event'&&source.parent_source_entity_id!=null;
    const parentMeetingId=parentSourceRequired
      ?(await client.query('select meeting_id from meeting_source_links where source_entity_id=$1',[source.parent_source_entity_id])).rows[0]?.meeting_id??null
      :null;
    const parentMeeting=parentMeetingId?(await client.query('select championship_id,championship_season_id,venue_id,venue_layout_id from meetings where id=$1',[parentMeetingId])).rows[0]:null;
    const explicitExternalSeasonId=typeof source.source_data?.external_season_id==='string'&&source.source_data.external_season_id.trim()?source.source_data.external_season_id.trim():null;
    const seasonLink=!parentMeeting&&explicitExternalSeasonId?(await client.query(`select championship_season_id,championship_id from championship_season_source_links
      where provider_instance_id=$1 and external_championship_id=$2 and external_season_id=$3`,[source.provider_instance_id,source.championship_source_id,explicitExternalSeasonId])).rows[0]:null;
    const championshipSeasonId=parentMeeting?.championship_season_id??seasonLink?.championship_season_id??null;
    const mappedCircuitId=input.mapping.circuitIds[String(source.source_data?.circuit_id??'')]??null;
    const circuitVenue=mappedCircuitId?(await client.query('select venue_id,venue_layout_id from circuit_venue_links where circuit_id=$1',[mappedCircuitId])).rows[0]:null;
    const venueId=circuitVenue?.venue_id??parentMeeting?.venue_id??null,venueLayoutId=circuitVenue?.venue_layout_id??parentMeeting?.venue_layout_id??null;
    if(championshipSeasonId){
      const identityLock=envelope.kind==='meeting'
        ?`f5-meeting:${input.mapping.championshipIds[envelope.championshipSourceId]??''}:${championshipSeasonId}:${String(source.source_data?.round??'')}:${String(source.source_data?.name??'')}:${String(source.source_data?.starts_at??'')}`
        :`f5-event:${parentMeetingId??'unresolved'}:${String(source.source_data?.session_type??'')}:${String(source.source_data?.starts_at??'')}`;
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[identityLock]);
    }
    const candidateRows=envelope.kind==='event'&&parentSourceRequired&&!parentMeetingId?[]:envelope.kind==='event'?(await client.query(`select event.id,event.championship_id,extract(year from event.starts_at)::int season,relation.meeting_id,
      event.session_type_key session_type,event.starts_at,event.circuit_id,event.venue_id,event.name,null::text round,meeting.championship_season_id
      from events event join meeting_events relation on relation.event_id=event.id join meetings meeting on meeting.id=relation.meeting_id
      where event.normalized_uuid is not null and event.championship_id=$1 and meeting.championship_season_id=$2
        and ($3::uuid is null or relation.meeting_id=$3)
      order by event.starts_at,event.id limit 51`,[input.mapping.championshipIds[envelope.championshipSourceId]??'',championshipSeasonId,parentSourceRequired?parentMeetingId:null])).rows
      :(await client.query(`select id,championship_id,championship_season_id,season,null::uuid meeting_id,'other'::text session_type,starts_at,null::text circuit_id,venue_id,name,round
        from meetings where championship_id=$1 and championship_season_id=$2 order by starts_at nulls last,id limit 51`,[input.mapping.championshipIds[envelope.championshipSourceId]??'',championshipSeasonId])).rows;
    const candidates:MatchCandidate[]=candidateRows.map(row=>({id:String(row.id),championshipId:String(row.championship_id),championshipSeasonId:row.championship_season_id?String(row.championship_season_id):null,season:row.season==null?null:Number(row.season),meetingId:row.meeting_id?String(row.meeting_id):null,sessionType:row.session_type??'other',startsAt:row.starts_at?new Date(row.starts_at).toISOString():null,circuitId:row.circuit_id?String(row.circuit_id):null,venueId:row.venue_id?String(row.venue_id):null,name:String(row.name),round:row.round?String(row.round):null}));
    const rejected=(await client.query(`select target_id from normalization_decisions where source_entity_id=$1 and decision='rejected' and target_kind=$2 and target_id is not null order by target_id`,[input.sourceEntityId,envelope.kind])).rows.map(row=>String(row.target_id));
    let result=normalize(envelope,input.mapping,candidates,existing?String(existing):null,rejected,{parentSourceRequired,parentCanonicalResolved:parentMeetingId!=null,championshipSeasonId:championshipSeasonId?String(championshipSeasonId):null,venueId:venueId?String(venueId):null,venueLayoutId:venueLayoutId?String(venueLayoutId):null});
    const candidateData={normalized:result.state,resolution:result.resolution,proposed_uuid:result.proposedUuid,checksum:result.checksum};
    await client.query(`insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data)
      values($1,$2,$3,$4,$5,$6::jsonb) on conflict(source_entity_id,source_hash,normalization_version,resource_kind) do nothing`,[result.candidateId,input.sourceEntityId,envelope.sourceHash,input.mapping.version,envelope.kind,JSON.stringify(candidateData)]);
    let persisted=(await client.query(`select id,candidate_data,revision,resolution_state from normalized_candidates where source_entity_id=$1 and source_hash=$2 and normalization_version=$3 and resource_kind=$4 for update`,[input.sourceEntityId,envelope.sourceHash,input.mapping.version,envelope.kind])).rows[0];
    let persistedData=typeof persisted?.candidate_data==='string'?JSON.parse(persisted.candidate_data) as typeof candidateData:persisted?.candidate_data as typeof candidateData|undefined;
    if(!persisted||!persistedData||typeof persistedData.checksum!=='string')throw new Error('normalization_replay_conflict');
    if(persistedData.checksum!==result.checksum){
      if(['PENDING','REVIEW_REQUIRED'].includes(String(persisted.resolution_state))){
        persisted=(await client.query(`update normalized_candidates set candidate_data=$2::jsonb,revision=revision+1,resolution_state='PENDING',updated_at=now()
          where id=$1 returning id,candidate_data,revision,resolution_state`,[persisted.id,JSON.stringify(candidateData)])).rows[0];
        persistedData=candidateData;
      }else result={...result,state:persistedData.normalized,resolution:persistedData.resolution,proposedUuid:persistedData.proposed_uuid,checksum:persistedData.checksum};
    }
    const candidateRevision=Number(persisted.revision),idempotencyKey=`deterministic:${persisted.id}:${candidateRevision}`;
    const decisionFingerprint=stableHash({candidateId:String(persisted.id),expectedRevision:candidateRevision,decision:result.resolution.decision,reason:result.resolution.reason,targetKind:result.resolution.decision==='linked'?envelope.kind:null,targetId:result.resolution.targetId,canonical:result.state});
    const decisionId=stableUuid('mse-normalization-decision',{candidateId:persisted.id,candidateRevision,decisionFingerprint});
    const targetKind=result.resolution.decision==='linked'?envelope.kind:null,targetId=result.resolution.decision==='linked'?result.resolution.targetId:null;
    await client.query(`insert into normalization_decisions(id,source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version,actor_id,reason,idempotency_key,decision_fingerprint)
      values($1,$2,$3,$4,$5,$6,$7,$8,'deterministic-normalizer',$9,$10,$11) on conflict(candidate_id,idempotency_key) do nothing`,[decisionId,input.sourceEntityId,persisted.id,candidateRevision,result.resolution.decision,targetKind,targetId,input.mapping.version,result.resolution.reason,idempotencyKey,decisionFingerprint]);
    const persistedDecision=(await client.query('select decision_fingerprint from normalization_decisions where candidate_id=$1 and idempotency_key=$2',[persisted.id,idempotencyKey])).rows[0];
    if(!persistedDecision||String(persistedDecision.decision_fingerprint)!==decisionFingerprint)throw new Error('normalization_idempotency_conflict');
    if(result.resolution.decision==='linked'&&!existing&&targetId){
      if(envelope.kind==='event'){const target=(await client.query('select normalized_uuid from events where id=$1 and normalized_uuid is not null',[targetId])).rows[0];if(!target)throw new Error('normalization_target_not_found');await client.query(`insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values($1,$2,$3,$4)`,[input.sourceEntityId,targetId,target.normalized_uuid,input.mapping.version]);}
      else await client.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,$3)`,[input.sourceEntityId,targetId,input.mapping.version]);
    }
    const currentCheckpoint=(await client.query('select * from normalization_checkpoints where scope_key=$1 for update',[input.scopeKey])).rows[0];
    if(currentCheckpoint&&Number(currentCheckpoint.fence_generation)!==input.expectedFenceGeneration)throw new Error('normalization_checkpoint_stale');
    if(currentCheckpoint?.last_source_changed_at&&new Date(currentCheckpoint.last_source_changed_at).valueOf()>new Date(envelope.lastChangedAt).valueOf())throw new Error('normalization_checkpoint_stale');
    const replay=currentCheckpoint&&String(currentCheckpoint.last_source_entity_id)===input.sourceEntityId&&String(currentCheckpoint.normalization_version)===input.mapping.version&&new Date(currentCheckpoint.last_source_changed_at).valueOf()===new Date(envelope.lastChangedAt).valueOf();
    const checkpoint=replay?currentCheckpoint:(await client.query(`insert into normalization_checkpoints(scope_key,normalization_version,last_source_entity_id,last_source_changed_at,fence_generation)
      values($1,$2,$3,$4,$5) on conflict(scope_key) do update set normalization_version=excluded.normalization_version,last_source_entity_id=excluded.last_source_entity_id,last_source_changed_at=excluded.last_source_changed_at,revision=normalization_checkpoints.revision+1,updated_at=now()
      where normalization_checkpoints.fence_generation=$5 and (normalization_checkpoints.last_source_changed_at is null or excluded.last_source_changed_at>=normalization_checkpoints.last_source_changed_at) returning *`,[input.scopeKey,input.mapping.version,input.sourceEntityId,envelope.lastChangedAt,input.expectedFenceGeneration])).rows[0];
    if(!checkpoint)throw new Error('normalization_checkpoint_stale');
    return {...result,candidateId:String(persisted.id),decisionId,checkpointRevision:Number(checkpoint.revision)};
  }
}
