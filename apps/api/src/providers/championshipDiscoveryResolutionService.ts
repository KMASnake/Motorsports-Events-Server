import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../lib/db.js';

export const F5_DISCOVERY_NORMALIZER_VERSION = 'f5-4-v1';
const sensitive = /authorization|token|secret|password|cookie|api[_-]?key|ciphertext|nonce|credential/i;
const status = (statusCode:number,message:string) => Object.assign(new Error(message),{statusCode});

type Json = null|boolean|number|string|Json[]|{[key:string]:Json};
export type ObservationInput={
  providerInstanceId:string; discoveryRunId:string;
  provenance:'provider_discovered'|'adapter_known_catalog'|'test_fixture';
  externalChampionshipId:string; externalSeasonId?:string|null;
  championshipName:string; seasonLabel?:string|null;
  startYear?:number|null; endYear?:number|null; startDate?:string|null; endDate?:string|null;
  discipline?:string|null; payload:Record<string,Json>; observedAt:Date;
};
export type DecisionInput={
  expectedRevision:number; idempotencyKey:string; reason?:string|null;
  decision:'link'|'create'|'reject';
  championshipId?:string; championshipSeasonId?:string|null;
  championship?:{name:string;slug?:string;disciplineKey?:string|null;season?:number};
  season?:{key:string;label:string;startYear?:number|null;endYear?:number|null;startsOn?:string|null;endsOn?:string|null};
};
export type DecisionContext={actor:string;requestId:string};
type CandidateState='PENDING'|'REVIEW_REQUIRED'|'RESOLVED_LINKED'|'RESOLVED_CREATED'|'REJECTED';

const discoveryIdentity=z.object({
  id:z.string().trim().min(1).max(256).optional(),
  external_id:z.string().trim().min(1).max(256).optional(),
  name:z.string().trim().min(1).max(500).optional(),
  label:z.string().trim().min(1).max(500).optional(),
  discipline:z.string().trim().min(1).max(128).optional(),
  category:z.string().trim().min(1).max(128).optional()
}).strict();
const discoverySeason=z.object({
  id:z.string().trim().min(1).max(256).optional(),
  external_id:z.string().trim().min(1).max(256).optional(),
  label:z.string().trim().min(1).max(500).optional(),
  start_year:z.number().int().min(1800).max(2400).optional(),
  end_year:z.number().int().min(1800).max(2400).optional(),
  start_date:z.string().trim().min(1).max(32).optional(),
  end_date:z.string().trim().min(1).max(32).optional()
}).strict();
const discoveryCatalog=z.object({
  id:z.string().trim().min(1).max(256).optional(),
  code:z.string().trim().min(1).max(256).optional(),
  name:z.string().trim().min(1).max(500).optional(),
  label:z.string().trim().min(1).max(500).optional(),
  discipline:z.string().trim().min(1).max(128).optional(),
  category:z.string().trim().min(1).max(128).optional()
}).strict();
const discoveryPayload=z.object({
  championship:discoveryIdentity.optional(),season:discoverySeason.optional(),catalog:discoveryCatalog.optional()
}).strict().refine(value=>Boolean(value.championship||value.season||value.catalog),{message:'Discovery payload must describe a Championship, Season or catalog entry.'});

function canonical(value:Json):string{
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key]!)}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function normalizedDiscoveryName(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
export function normalizedSeasonLabel(value:string){
  const cleanLabel=value.trim().toLowerCase().replace(/^season\s+/,'').replace(/\s+/g,'');
  const range=cleanLabel.match(/^(\d{4})[/-](\d{2}|\d{4})$/);
  if(range){const end=range[2].length===2?`${range[1].slice(0,2)}${range[2]}`:range[2];return `${range[1]}-${end}`;}
  return /^\d{4}$/.test(cleanLabel)?cleanLabel:normalizedDiscoveryName(value);
}
function rejectSensitive(value:Json,path='payload'){
  if(Array.isArray(value)){value.forEach((child,index)=>rejectSensitive(child,`${path}[${index}]`));return;}
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){if(sensitive.test(key))throw status(400,`Sensitive discovery field refused at ${path}.${key}.`);rejectSensitive(child,`${path}.${key}`);}
}
function clean(value:string|undefined|null,max=500){const result=value?.trim()??'';return result?result.slice(0,max):null;}
function slug(value:string,id:string){const base=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'championship';return `${base.slice(0,100)}-${id.slice(0,8)}`;}
async function transaction<T>(operation:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('begin');const value=await operation(client);await client.query('commit');return value;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}

export function assertCandidateTransition(from:CandidateState,to:CandidateState){
  const allowed:Record<CandidateState,CandidateState[]>={
    PENDING:['REVIEW_REQUIRED','RESOLVED_LINKED','REJECTED'],
    REVIEW_REQUIRED:['RESOLVED_LINKED','RESOLVED_CREATED','REJECTED'],
    RESOLVED_LINKED:[],RESOLVED_CREATED:[],REJECTED:[]
  };
  if(!allowed[from]?.includes(to))throw status(409,`Invalid discovery candidate transition: ${from} -> ${to}.`);
}

function decisionFingerprint(candidateId:string,input:DecisionInput){
  return digest(canonical({
    candidateId,expectedRevision:input.expectedRevision,decision:input.decision,reason:clean(input.reason,2000),
    championshipId:input.championshipId??null,championshipSeasonId:input.championshipSeasonId??null,
    championship:input.championship?{name:clean(input.championship.name,120),slug:clean(input.championship.slug,120),disciplineKey:clean(input.championship.disciplineKey,64),season:input.championship.season??null}:null,
    season:input.season?{key:clean(input.season.key,120),label:clean(input.season.label,200),startYear:input.season.startYear??null,endYear:input.season.endYear??null,startsOn:input.season.startsOn??null,endsOn:input.season.endsOn??null}:null
  }));
}

export class ChampionshipDiscoveryResolutionService{
  async ingestObservation(input:ObservationInput){
    rejectSensitive(input.payload);
    const parsedPayload=discoveryPayload.safeParse(input.payload);
    if(!parsedPayload.success)throw status(400,'Discovery payload does not match the Championship/Season catalog schema.');
    const serialized=canonical(parsedPayload.data as Json);
    if(Buffer.byteLength(serialized)>65536)throw status(413,'Discovery payload exceeds 65536 bytes.');
    const externalChampionshipId=clean(input.externalChampionshipId,256),name=clean(input.championshipName);
    if(!externalChampionshipId||!name)throw status(400,'Discovery identity is incomplete.');
    const externalSeasonId=clean(input.externalSeasonId,256),seasonLabel=clean(input.seasonLabel);
    const payloadChecksum=digest(serialized);
    const fingerprint=digest(canonical({providerInstanceId:input.providerInstanceId,externalChampionshipId,externalSeasonId,name,seasonLabel,startYear:input.startYear??null,endYear:input.endYear??null,startDate:input.startDate??null,endDate:input.endDate??null,discipline:clean(input.discipline,128),payloadChecksum}));
    const sourceIdentityHash=digest(canonical({providerInstanceId:input.providerInstanceId,externalChampionshipId,externalSeasonId}));
    return transaction(async client=>{
      const run=await client.query('select id from provider_discovery_runs where id=$1 and provider_instance_id=$2',[input.discoveryRunId,input.providerInstanceId]);
      if(!run.rowCount)throw status(404,'Discovery run not found in provider scope.');
      const observationId=randomUUID();
      await client.query(`insert into provider_discovery_observations(
        id,provider_instance_id,provider_discovery_run_id,provenance,external_championship_id,external_season_id,
        raw_championship_name,raw_season_label,raw_start_year,raw_end_year,raw_start_date,raw_end_date,
        raw_discipline,payload,payload_checksum,observation_fingerprint,observed_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)
        on conflict(provider_discovery_run_id,observation_fingerprint) do nothing`,[
        observationId,input.providerInstanceId,input.discoveryRunId,input.provenance,externalChampionshipId,externalSeasonId,
        name,seasonLabel,input.startYear??null,input.endYear??null,input.startDate??null,input.endDate??null,
        clean(input.discipline,128),serialized,payloadChecksum,fingerprint,input.observedAt
      ]);
      const observation=(await client.query(`select * from provider_discovery_observations
        where provider_discovery_run_id=$1 and observation_fingerprint=$2`,[input.discoveryRunId,fingerprint])).rows[0];
      return this.resolveCandidate(client,observation,sourceIdentityHash);
    });
  }

  private async resolveCandidate(client:PoolClient,observation:any,sourceIdentityHash:string){
    const championshipLink=(await client.query(`select * from championship_source_links
      where provider_instance_id=$1 and external_championship_id=$2`,[observation.provider_instance_id,observation.external_championship_id])).rows[0]??null;
    const disciplineKey=observation.raw_discipline&&/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(observation.raw_discipline)
      &&(await client.query('select key from disciplines where key=$1',[observation.raw_discipline])).rowCount?observation.raw_discipline:null;
    const normalizedName=normalizedDiscoveryName(observation.raw_championship_name);
    const canonicalRows=disciplineKey?(await client.query('select id,name,discipline_key from championships where discipline_key=$1',[disciplineKey])).rows:[];
    const exact=canonicalRows.filter(row=>normalizedDiscoveryName(row.name)===normalizedName);
    const proposedChampionshipId=championshipLink?.championship_id??(exact.length===1?exact[0].id:null);
    let proposedSeasonId:string|null=null;
    let state='REVIEW_REQUIRED',matchReason='no_credible_canonical_match';
    let reviewReason:string|null='explicit_admin_decision_required';
    const signals:string[]=[];
    if(championshipLink){state='RESOLVED_LINKED';matchReason='durable_championship_source_link';reviewReason=null;signals.push('championship_source_link');}
    else if(exact.length===1){matchReason='unique_exact_name_and_discipline';signals.push('normalized_name','discipline');}
    else if(exact.length>1){matchReason='ambiguous_exact_name_and_discipline';reviewReason='ambiguous_championship';signals.push('normalized_name','discipline','multiple_targets');}
    else if(!disciplineKey){matchReason='discipline_missing_or_unknown';reviewReason='discipline_required_for_deterministic_match';}

    if(observation.external_season_id&&championshipLink){
      const seasonLink=(await client.query(`select * from championship_season_source_links
        where provider_instance_id=$1 and external_championship_id=$2 and external_season_id=$3`,[observation.provider_instance_id,observation.external_championship_id,observation.external_season_id])).rows[0]??null;
      if(seasonLink){proposedSeasonId=seasonLink.championship_season_id;signals.push('championship_season_source_link');}
      else{state='REVIEW_REQUIRED';matchReason='season_source_link_absent';reviewReason='explicit_season_decision_required';}
    }else if(observation.external_season_id&&proposedChampionshipId){
      const seasons=(await client.query('select * from championship_seasons where championship_id=$1',[proposedChampionshipId])).rows;
      const label=normalizedSeasonLabel(observation.raw_season_label??'');
      const matches=seasons.filter(row=>label&&normalizedSeasonLabel(row.label)===label
        &&(observation.raw_start_year===null||observation.raw_start_year===undefined||Number(row.start_year)===Number(observation.raw_start_year))
        &&(observation.raw_end_year===null||observation.raw_end_year===undefined||Number(row.end_year)===Number(observation.raw_end_year)));
      if(matches.length===1){proposedSeasonId=matches[0].id;signals.push('season_label_and_bounds');}
      else if(matches.length>1){reviewReason='ambiguous_season';matchReason='ambiguous_season_signals';}
    }
    const normalizedSeason={label:normalizedSeasonLabel(observation.raw_season_label??''),startYear:observation.raw_start_year??null,endYear:observation.raw_end_year??null,startDate:observation.raw_start_date??null,endDate:observation.raw_end_date??null};
    const candidateId=randomUUID();
    const result=await client.query(`insert into championship_discovery_candidates(
      id,provider_instance_id,source_identity_hash,normalizer_version,latest_observation_id,latest_observation_fingerprint,
      normalized_championship_name,normalized_discipline,normalized_season,proposed_championship_id,
      proposed_championship_season_id,match_reason,match_signals,confidence,resolution_state,review_reason)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16)
      on conflict(provider_instance_id,source_identity_hash,normalizer_version) do update set
        latest_observation_id=excluded.latest_observation_id,
        revision=championship_discovery_candidates.revision+case when championship_discovery_candidates.latest_observation_fingerprint is distinct from excluded.latest_observation_fingerprint then 1 else 0 end,
        latest_observation_fingerprint=excluded.latest_observation_fingerprint,
        normalized_championship_name=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.normalized_championship_name else excluded.normalized_championship_name end,
        normalized_discipline=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.normalized_discipline else excluded.normalized_discipline end,
        normalized_season=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.normalized_season else excluded.normalized_season end,
        proposed_championship_id=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.proposed_championship_id else excluded.proposed_championship_id end,
        proposed_championship_season_id=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.proposed_championship_season_id else excluded.proposed_championship_season_id end,
        match_reason=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.match_reason else excluded.match_reason end,
        match_signals=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.match_signals else excluded.match_signals end,
        confidence=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.confidence else excluded.confidence end,
        resolution_state=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.resolution_state else excluded.resolution_state end,
        review_reason=case when championship_discovery_candidates.resolution_state in('RESOLVED_LINKED','RESOLVED_CREATED','REJECTED') then championship_discovery_candidates.review_reason else excluded.review_reason end,
        updated_at=now()
      returning *`,[candidateId,observation.provider_instance_id,sourceIdentityHash,F5_DISCOVERY_NORMALIZER_VERSION,observation.id,observation.observation_fingerprint,normalizedName,disciplineKey,JSON.stringify(normalizedSeason),proposedChampionshipId,proposedSeasonId,matchReason,JSON.stringify(signals),championshipLink?1:exact.length===1?0.95:null,state,reviewReason]);
    return {observation,candidate:result.rows[0]};
  }

  async list(input:{state?:string;limit:number;offset:number}){const values:any[]=[];let where='';if(input.state){values.push(input.state);where=`where resolution_state=$${values.length}`;}values.push(input.limit,input.offset);return (await pool.query(`select * from championship_discovery_candidates ${where} order by updated_at desc,id limit $${values.length-1} offset $${values.length}`,values)).rows;}
  async detail(id:string){const candidate=(await pool.query('select * from championship_discovery_candidates where id=$1',[id])).rows[0];if(!candidate)return null;const observation=(await pool.query('select * from provider_discovery_observations where id=$1',[candidate.latest_observation_id])).rows[0];const decisions=(await pool.query('select * from championship_discovery_decisions where candidate_id=$1 order by decided_at,id',[id])).rows;return {candidate,observation,decisions};}

  async decide(candidateId:string,input:DecisionInput,context:DecisionContext){return transaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`f5-discovery:${candidateId}`]);
    const fingerprint=decisionFingerprint(candidateId,input);
    const replay=(await client.query('select * from championship_discovery_decisions where candidate_id=$1 and idempotency_key=$2',[candidateId,input.idempotencyKey])).rows[0];
    if(replay){
      if(replay.decision_fingerprint!==fingerprint)throw status(409,'Idempotency key conflicts with another discovery decision request.');
      const replayedCandidate=(await client.query('select * from championship_discovery_candidates where id=$1',[candidateId])).rows[0];
      return {decision:replay,candidate:replayedCandidate,replayed:true};
    }
    const candidate=(await client.query(`select candidate.*,observation.external_championship_id,observation.external_season_id,
      observation.raw_championship_name,observation.raw_season_label,observation.raw_start_year,observation.raw_end_year,
      observation.raw_start_date,observation.raw_end_date from championship_discovery_candidates candidate
      join provider_discovery_observations observation on observation.id=candidate.latest_observation_id
      where candidate.id=$1 for update of candidate`,[candidateId])).rows[0];
    if(!candidate)throw status(404,'Discovery candidate not found.');
    if(Number(candidate.revision)!==input.expectedRevision)throw status(409,'Discovery candidate revision conflict.');
    if(input.decision==='reject'&&!clean(input.reason,2000))throw status(400,'A rejection reason is required.');

    let championshipId:string|null=null,seasonId:string|null=null;
    const newState:CandidateState=input.decision==='create'?'RESOLVED_CREATED':input.decision==='link'?'RESOLVED_LINKED':'REJECTED';
    assertCandidateTransition(candidate.resolution_state as CandidateState,newState);
    if(input.decision==='link'){
      championshipId=input.championshipId??null;seasonId=input.championshipSeasonId??null;
      if(!championshipId)throw status(400,'A canonical Championship is required.');
      if(!(await client.query('select id from championships where id=$1',[championshipId])).rowCount)throw status(404,'Canonical Championship not found.');
      if(seasonId&&!(await client.query('select id from championship_seasons where id=$1 and championship_id=$2',[seasonId,championshipId])).rowCount)throw status(400,'Canonical Season does not belong to Championship.');
    }else if(input.decision==='create'){
      if(input.championshipId){championshipId=input.championshipId;if(!(await client.query('select id from championships where id=$1',[championshipId])).rowCount)throw status(404,'Canonical Championship not found.');}
      else{
        if(!input.championship?.name)throw status(400,'Championship creation data is required.');
        championshipId=randomUUID();const generatedSlug=input.championship.slug??slug(input.championship.name,championshipId);
        await client.query(`insert into championships(id,slug,name,season,active,sync_enabled,discipline_key)
          values($1,$2,$3,$4,true,false,$5)`,[championshipId,generatedSlug,input.championship.name,input.championship.season??candidate.raw_start_year??new Date().getUTCFullYear(),input.championship.disciplineKey??candidate.normalized_discipline]);
      }
      if(input.season){seasonId=randomUUID();await client.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year,starts_on,ends_on)
        values($1,$2,$3,$4,$5,$6,$7,$8)`,[seasonId,championshipId,input.season.key,input.season.label,input.season.startYear??null,input.season.endYear??null,input.season.startsOn??null,input.season.endsOn??null]);}
    }

    if(championshipId){
      const existing=(await client.query(`select * from championship_source_links where provider_instance_id=$1 and external_championship_id=$2`,[candidate.provider_instance_id,candidate.external_championship_id])).rows[0];
      let championshipLink=existing;
      if(existing&&existing.championship_id!==championshipId)throw status(409,'Source Championship is linked to another canonical identity.');
      if(!existing)championshipLink=(await client.query(`insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by)
        values($1,$2,$3,$4,$5) returning *`,[randomUUID(),candidate.provider_instance_id,candidate.external_championship_id,championshipId,context.actor])).rows[0];
      if(seasonId&&candidate.external_season_id){
        const existingSeason=(await client.query(`select * from championship_season_source_links where provider_instance_id=$1 and external_championship_id=$2 and external_season_id=$3`,[candidate.provider_instance_id,candidate.external_championship_id,candidate.external_season_id])).rows[0];
        if(existingSeason&&existingSeason.championship_season_id!==seasonId)throw status(409,'Source Season is linked to another canonical identity.');
        if(!existingSeason)await client.query(`insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by)
          values($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),championshipLink.id,candidate.provider_instance_id,candidate.external_championship_id,candidate.external_season_id,championshipId,seasonId,context.actor]);
      }
    }
    const decision=(await client.query(`insert into championship_discovery_decisions(id,candidate_id,candidate_revision,observation_id,decision,actor_id,reason,chosen_championship_id,chosen_championship_season_id,idempotency_key,decision_fingerprint)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[randomUUID(),candidate.id,candidate.revision,candidate.latest_observation_id,input.decision,context.actor,clean(input.reason,2000),championshipId,seasonId,input.idempotencyKey,fingerprint])).rows[0];
    const updated=(await client.query(`update championship_discovery_candidates set revision=revision+1,resolution_state=$2,
      proposed_championship_id=$3,proposed_championship_season_id=$4,match_reason=$5,review_reason=null,updated_at=now()
      where id=$1 returning *`,[candidate.id,newState,championshipId,seasonId,`admin_${input.decision}`])).rows[0];
    await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
      values($1,'discovery.resolution_decided','championship_discovery_candidate',$2,$3,$4::jsonb,$5::jsonb)`,[context.actor,candidate.id,context.requestId,JSON.stringify({revision:candidate.revision,state:candidate.resolution_state}),JSON.stringify({revision:updated.revision,state:updated.resolution_state,decisionId:decision.id})]);
    return {decision,candidate:updated,replayed:false};
  });}
}
