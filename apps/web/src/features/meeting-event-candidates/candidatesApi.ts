import {adminAuthorization,notifyAuthenticationRequired} from '../../lib/adminAuth';

const API=import.meta.env.VITE_API_URL??(import.meta.env.DEV?'http://localhost:3001':'');
const ROOT='/api/v1/admin/meeting-event-resolution-candidates';
export const candidateStates=['PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED'] as const;
export type CandidateState=typeof candidateStates[number];
export type CandidateRow={id:string;source_entity_id?:string;resource_kind:'meeting'|'event';resolution_state?:string;revision?:number;created_at?:string;updated_at?:string};
export type CandidateDetail={candidate:CandidateRow&Record<string,unknown>;decisions:Record<string,unknown>[]};
export const PAGE_SIZE=25;
export class CandidateReadError extends Error {constructor(readonly status:number,message:string){super(message);}}
export function record(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function candidateData(value:unknown):Record<string,unknown>{if(typeof value==='string'){try{return record(JSON.parse(value));}catch{return {};}}return record(value);}
function isRow(value:unknown):value is CandidateRow{const row=record(value);return typeof row.id==='string'&&['meeting','event'].includes(String(row.resource_kind));}
async function get(path:string,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch(API+path,{method:'GET',credentials:'include',headers:adminAuthorization(),signal});
  if(response.status===401)notifyAuthenticationRequired();
  if(!response.ok)throw new CandidateReadError(response.status,response.status===403?'Accès refusé.':response.status===401?'Authentification requise.':response.status===404?'Ce candidat n’est plus disponible.':'Impossible de consulter les candidats.');
  return response.json();
}
export async function listCandidates(state:CandidateState,offset:number,signal?:AbortSignal):Promise<CandidateRow[]>{
  if(!candidateStates.includes(state)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Filtres de candidats invalides.');
  const data=await get(`${ROOT}?${new URLSearchParams({state,limit:String(PAGE_SIZE),offset:String(offset)})}`,signal);
  if(!Array.isArray(data)||!data.every(isRow))throw new Error('Réponse de liste inexploitable.');
  return data;
}
export async function getCandidate(id:string,signal?:AbortSignal):Promise<CandidateDetail>{
  const data=record(await get(`${ROOT}/${encodeURIComponent(id)}`,signal));
  if(!isRow(data.candidate)||data.candidate.id!==id||!Array.isArray(data.decisions))throw new Error('Réponse de détail inexploitable.');
  return {candidate:data.candidate as CandidateDetail['candidate'],decisions:data.decisions.map(record)};
}
