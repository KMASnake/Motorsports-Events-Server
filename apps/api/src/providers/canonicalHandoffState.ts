import type {PoolClient} from 'pg';
import type {JsonObject} from './contracts.js';

export const handoffKey='canonical_handoff_v1';
export type HandoffStatus='ACQUIRING'|'HANDOFF_PENDING'|'HANDOFF_BACKOFF'|'HANDOFF_PAUSED'|'HANDOFF_BLOCKED'|'DONE'|'DONE_WITH_REVIEW'|'ABANDONED';
export type HandoffEntry={state:HandoffStatus;attempts:number;updated_at:string;error_code:string|null};
export type HandoffEnvelope={version:1;traversals:Record<string,HandoffEntry>};
const states:readonly string[]=['ACQUIRING','HANDOFF_PENDING','HANDOFF_BACKOFF','HANDOFF_PAUSED','HANDOFF_BLOCKED','DONE','DONE_WITH_REVIEW','ABANDONED'];
export const terminalHandoff=(state:HandoffStatus)=>state==='DONE'||state==='DONE_WITH_REVIEW'||state==='ABANDONED';
export const protectedHandoff=(state:HandoffStatus)=>state!=='ACQUIRING'&&!terminalHandoff(state);
export class HandoffStateError extends Error{
  readonly statusCode=409;
  constructor(readonly code:string){super(code);}
}

export function readHandoffEnvelope(historical:JsonObject):HandoffEnvelope{
  const raw=historical[handoffKey];
  if(raw===undefined)return {version:1,traversals:{}};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new HandoffStateError('handoff_envelope_invalid');
  const value=raw as unknown as HandoffEnvelope;
  if(value.version!==1||!value.traversals||typeof value.traversals!=='object'||Array.isArray(value.traversals))throw new HandoffStateError('handoff_envelope_invalid');
  for(const [id,entry] of Object.entries(value.traversals)){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!entry||!states.includes(entry.state)||!Number.isSafeInteger(entry.attempts)||entry.attempts<0||!Number.isFinite(Date.parse(entry.updated_at))||(entry.error_code!==null&&typeof entry.error_code!=='string'))throw new HandoffStateError('handoff_envelope_invalid');
  }
  return value;
}

// Reuse the scheduler's existing serialization root. Never hold it over HTTP.
// Canonical work is deliberately serialized in A1; finer admission is a later slice.
export async function lockHandoffDomain(client:PoolClient){
  if(!(await client.query('select singleton from scheduler_configuration where singleton=true for update')).rowCount)throw new HandoffStateError('scheduler_configuration_missing');
}

export async function assertNoPendingHandoff(client:PoolClient,linkId:string){
  const rows=(await client.query('select historical_state from sync_streams where provider_championship_id=$1 order by id for update',[linkId])).rows;
  for(const row of rows)if(Object.values(readHandoffEnvelope(row.historical_state).traversals).some(entry=>protectedHandoff(entry.state)))throw new HandoffStateError('canonical_handoff_pending');
}

export async function writeHandoffState(client:PoolClient,streamId:string,traversalId:string,state:HandoffStatus,now:Date,errorCode:string|null=null,attempt=false){
  const row=(await client.query('select historical_state from sync_streams where id=$1 for update',[streamId])).rows[0];
  if(!row)throw new HandoffStateError('handoff_stream_missing');
  const envelope=readHandoffEnvelope(row.historical_state),previous=envelope.traversals[traversalId];
  envelope.traversals[traversalId]={state,attempts:(previous?.attempts??0)+(attempt?1:0),updated_at:now.toISOString(),error_code:errorCode};
  await client.query('update sync_streams set historical_state=jsonb_set(historical_state,$2::text[],$3::jsonb),updated_at=$4 where id=$1',[streamId,[handoffKey],JSON.stringify(envelope),now]);
}

// Generic scheduler writers may replace their own historical fields, never this namespace.
export function preserveHandoffEnvelope(current:JsonObject,replacement:JsonObject):JsonObject{
  readHandoffEnvelope(current);
  const next={...replacement};delete next[handoffKey];
  return current[handoffKey]===undefined?next:{...next,[handoffKey]:current[handoffKey]};
}
