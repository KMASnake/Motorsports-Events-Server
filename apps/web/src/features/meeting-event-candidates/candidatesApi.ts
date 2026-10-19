import {adminAuthorization,notifyAuthenticationRequired} from '../../lib/adminAuth';

const API=import.meta.env.VITE_API_URL??(import.meta.env.DEV?'http://localhost:3001':'');
const ROOT='/api/v1/admin/meeting-event-resolution-candidates';
export const candidateStates=['PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED'] as const;
export type CandidateState=typeof candidateStates[number];
export type CandidateRow={id:string;source_entity_id?:string;resource_kind:'meeting'|'event';resolution_state?:string;revision?:number|string;created_at?:string;updated_at?:string};
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

/** PostgreSQL bigint is returned as decimal text; reject unsafe JS revisions. */
export function safeCandidateRevision(value:unknown):number|null{
  if(typeof value!=='number'&&(typeof value!=='string'||!/^[1-9]\d*$/.test(value)))return null;
  const revision=Number(value);return Number.isSafeInteger(revision)&&revision>0?revision:null;
}
export type RejectionIntent=Readonly<{candidateId:string;revision:number;reason:string;key:string}>;
export type RejectionReceipt=Readonly<{decision:Record<string,unknown>;replayed:boolean}>;
export class CandidateDecisionError extends Error {constructor(readonly status:number,message:string){super(message);}}
export async function rejectCandidate(intent:RejectionIntent):Promise<RejectionReceipt>{
  const messages:Record<number,string>={400:'Rejet refusé : vérifier le motif et les données.',401:'Authentification requise.',403:'Accès refusé pour le rejet.',404:'Ce candidat n’est plus disponible.',409:'Conflit : les données doivent être rechargées et une nouvelle confirmation est nécessaire.'};
  let response:Response;
  try{response=await fetch(`${API}${ROOT}/${encodeURIComponent(intent.candidateId)}/decisions`,{method:'POST',credentials:'include',headers:{...adminAuthorization(),'Content-Type':'application/json'},body:JSON.stringify({action:'reject',expected_revision:intent.revision,idempotency_key:intent.key,reason:intent.reason})});}
  catch{throw new CandidateDecisionError(0,'Réponse perdue ou indisponible. Le résultat est incertain ; réessayer la même intention conservera sa clé d’idempotence.');}
  if(response.status===401)notifyAuthenticationRequired();
  if(!response.ok)throw new CandidateDecisionError(response.status,messages[response.status]??'Erreur serveur : le résultat du rejet est incertain. Un nouvel essai de la même intention conserve sa clé.');
  const body=record(await response.json().catch(()=>null)),decision=record(body.decision);
  if(decision.candidate_id!==intent.candidateId||safeCandidateRevision(decision.candidate_revision)!==intent.revision||decision.decision!=='rejected'||decision.reason!==intent.reason||decision.idempotency_key!==intent.key||typeof body.replayed!=='boolean'||(body.publication!==undefined&&body.publication!==null))throw new CandidateDecisionError(0,'Confirmation serveur inexploitable : aucun succès annoncé. Réessayer la même intention conservera sa clé.');
  return {decision,replayed:body.replayed};
}
