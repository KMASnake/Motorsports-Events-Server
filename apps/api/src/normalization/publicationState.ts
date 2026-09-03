import {stableHash} from './deterministicNormalization.js';

export type PublicResourceType='event'|'meeting'|'championship';
export type PublicationQuality='ready'|'review_required'|'blocked';
export type PublicOperation='created'|'updated'|'removed'|'availability_changed';

const PUBLIC_FIELDS=['resourceKind','name','sessionType','sessionLabel','status','championshipId','circuitId','season','round','startsAt','endsAt','timezone','presence'] as const;

export function canonicalPublicState(value:Readonly<Record<string,unknown>>):Readonly<Record<string,unknown>>{
  const state:Record<string,unknown>={};
  for(const field of PUBLIC_FIELDS) if(Object.hasOwn(value,field)) state[field]=value[field];
  const encoded=JSON.stringify(state);
  if(Buffer.byteLength(encoded,'utf8')>65_536)throw new Error('public_state_too_large');
  return state;
}

export function publicStateChecksum(value:Readonly<Record<string,unknown>>):string{
  return stableHash(canonicalPublicState(value));
}

export function changedPublicFields(before:Readonly<Record<string,unknown>>|null,after:Readonly<Record<string,unknown>>):string[]{
  if(!before)return Object.keys(after).sort((a,b)=>a.localeCompare(b,'en'));
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>stableHash(before[key])!==stableHash(after[key])).sort((a,b)=>a.localeCompare(b,'en'));
}

export function publicationQuality(candidate:Readonly<Record<string,unknown>>,decision:string):PublicationQuality{
  if(decision==='review')return 'review_required';
  if(decision==='rejected')return 'blocked';
  if(!candidate.championshipId||!candidate.circuitId)return 'review_required';
  return decision!=='create'||candidate.startsAt&&candidate.status&&!(candidate.resourceKind==='event'&&candidate.status==='confirmed')?'ready':'review_required';
}

export function granularQuality(input:{event:PublicationQuality;criticalEvent?:boolean;meeting?:PublicationQuality}):{event:PublicationQuality;meeting:'healthy'|'degraded'|'blocked';championship:'healthy'|'degraded'}{
  const meeting=input.meeting==='blocked'||(input.criticalEvent&&input.event!=='ready')?'blocked':input.event==='ready'?'healthy':'degraded';
  return {event:input.event,meeting,championship:meeting==='healthy'?'healthy':'degraded'};
}
