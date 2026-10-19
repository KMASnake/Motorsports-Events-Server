import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {pool} from '../lib/db.js';
import {stableHash} from './deterministicNormalization.js';
import {PostgresPublicationService} from './postgresPublicationService.js';

type Action='link'|'create'|'reject';
export type MeetingEventDecisionInput={expectedRevision:number;idempotencyKey:string;action:Action;reason:string;targetCanonicalId?:string|null};
export type MeetingEventDecisionContext={actor:string;requestId:string;occurredAt:Date};
const status=(statusCode:number,message:string)=>Object.assign(new Error(message),{statusCode});
const clean=(value:string,max:number)=>value.trim().slice(0,max);

async function transaction<T>(operation:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('begin');const value=await operation(client);await client.query('commit');return value;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}

export class MeetingEventResolutionService{
  constructor(readonly publication=new PostgresPublicationService()){}
  async list(input:{state?:string;limit:number;offset:number}){const values:unknown[]=[];let where="where resource_kind in ('meeting','event')";if(input.state){values.push(input.state);where+=` and resolution_state=$${values.length}`;}values.push(input.limit,input.offset);return (await pool.query(`select id,source_entity_id,resource_kind,resolution_state,revision,created_at,updated_at from normalized_candidates ${where} order by updated_at desc,id limit $${values.length-1} offset $${values.length}`,values)).rows;}
  async detail(id:string){const candidate=(await pool.query("select * from normalized_candidates where id=$1 and resource_kind in ('meeting','event')",[id])).rows[0];if(!candidate)return null;const decisions=(await pool.query('select * from normalization_decisions where candidate_id=$1 order by decided_at,id',[id])).rows;return {candidate,decisions};}

  decide(candidateId:string,input:MeetingEventDecisionInput,context:MeetingEventDecisionContext){return transaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`f5-meeting-event:${candidateId}`]);
    const candidate=(await client.query("select * from normalized_candidates where id=$1 and resource_kind in ('meeting','event') for update",[candidateId])).rows[0];
    if(!candidate)throw status(404,'Meeting/Event candidate not found.');
    const data=typeof candidate.candidate_data==='string'?JSON.parse(candidate.candidate_data):candidate.candidate_data,normalized=data?.normalized;
    const fingerprint=stableHash({candidateId,expectedRevision:input.expectedRevision,action:input.action,reason:clean(input.reason,2000),targetCanonicalId:input.targetCanonicalId??null,canonicalCandidateChecksum:data?.checksum??stableHash(normalized??null)});
    const replay=(await client.query('select * from normalization_decisions where candidate_id=$1 and idempotency_key=$2',[candidateId,input.idempotencyKey])).rows[0];
    if(replay){if(String(replay.decision_fingerprint)!==fingerprint)throw status(409,'Idempotency key conflicts with another Meeting/Event decision.');return {decision:replay,replayed:true};}
    if(Number(candidate.revision)!==input.expectedRevision)throw status(409,'Meeting/Event candidate revision conflict.');
    if(!['PENDING','REVIEW_REQUIRED'].includes(String(candidate.resolution_state)))throw status(409,'Meeting/Event candidate is terminal.');
    if(!normalized||!normalized.championshipId||!normalized.championshipSeasonId)throw status(409,'Meeting/Event candidate lacks canonical Championship/Season scope.');
    let decision:'linked'|'create'|'rejected',targetId:string|null=null,targetKind:string|null=null;
    if(input.action==='link'){
      if(!input.targetCanonicalId)throw status(400,'A canonical target is required.');
      targetKind=String(candidate.resource_kind);
      if(targetKind==='meeting'){
        const target=(await client.query('select id,championship_id,championship_season_id from meetings where id=$1 for update',[input.targetCanonicalId])).rows[0];
        if(!target)throw status(404,'Canonical Meeting not found.');
        if(String(target.championship_id)!==String(normalized.championshipId)||String(target.championship_season_id)!==String(normalized.championshipSeasonId))throw status(409,'Canonical Meeting scope does not match candidate.');
        targetId=String(target.id);
      }else{
        const target=(await client.query(`select event.id,event.championship_id,meeting.championship_season_id from events event
          join meeting_events relation on relation.event_id=event.id join meetings meeting on meeting.id=relation.meeting_id
          where event.normalized_uuid=$1 for update of event`,[input.targetCanonicalId])).rows[0];
        if(!target)throw status(404,'Canonical Event with exactly one Meeting not found.');
        if(String(target.championship_id)!==String(normalized.championshipId)||String(target.championship_season_id)!==String(normalized.championshipSeasonId))throw status(409,'Canonical Event scope does not match candidate.');
        targetId=String(target.id);
      }
      decision='linked';
    }else if(input.action==='create'){decision='create';}
    else{if(!clean(input.reason,2000))throw status(400,'A rejection reason is required.');decision='rejected';}
    const inserted=(await client.query(`insert into normalization_decisions(id,source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version,actor_id,reason,idempotency_key,decision_fingerprint,decided_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,[randomUUID(),candidate.source_entity_id,candidate.id,candidate.revision,decision,targetKind,targetId,candidate.normalization_version,context.actor,clean(input.reason,2000),input.idempotencyKey,fingerprint,context.occurredAt])).rows[0];
    let publication:{outcome:string;revision:number|null;sequence:number|null}|null=null;
    if(decision!=='rejected'){
      publication=await this.publication.publishCandidateInTransaction(client,{candidateId,occurredAt:context.occurredAt});
      const materialized=decision==='linked'?publication.outcome==='linked':['created','updated','unchanged'].includes(publication.outcome);
      if(!materialized)throw status(409,`Meeting/Event decision was not materialized (${publication.outcome}).`);
    }
    await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
      values($1,'normalization.meeting_event_decided','normalized_candidate',$2,$3,$4::jsonb,$5::jsonb)`,[context.actor,candidate.id,context.requestId,JSON.stringify({revision:candidate.revision,state:candidate.resolution_state}),JSON.stringify({revision:candidate.revision,state:decision==='linked'?'RESOLVED_LINKED':decision==='create'?'RESOLVED_CREATED':'REJECTED',decisionId:inserted.id,publication})]);
    return {decision:inserted,publication,replayed:false};
  });}
}
