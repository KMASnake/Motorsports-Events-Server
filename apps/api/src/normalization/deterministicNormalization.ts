import {createHash} from 'node:crypto';

export const EVENT_AUTO_MATCH_SCORE=90,EVENT_REVIEW_SCORE=75,EVENT_AUTO_MATCH_MARGIN=15,MAX_MATCH_CANDIDATES=50;
const forbiddenKeys=new Set(['__proto__','prototype','constructor']);

export type SessionType='practice'|'qualifying'|'sprint_qualifying'|'sprint'|'race'|'other';
export type NormalizedStatus='scheduled'|'confirmed'|'postponed'|'cancelled'|'completed';
export type Decision='linked'|'review'|'create'|'rejected';
export type Presence='seen'|'not_observed'|'stale'|'unknown';
export interface Correction {id:string;fieldPath:string;value:unknown;active:boolean}
export interface MappingConfig {
  version:string;rulesVersion:string;
  championshipIds:Readonly<Record<string,string>>;circuitIds:Readonly<Record<string,string>>;
  sessionTypes:Readonly<Record<string,SessionType>>;statuses:Readonly<Record<string,NormalizedStatus>>;
}
export interface SourceEnvelope {
  id:string;kind:'event'|'meeting';sourceHash:string;providerKey:string;championshipSourceId:string;
  season:number|null;data:Readonly<Record<string,unknown>>;corrections:readonly Correction[];
  lastChangedAt:string;lastObservedAt:string;observation?:'present'|'not_observed';traversalComplete:boolean;
  providerStartedAt:string|null;providerEndedAt:string|null;theoreticalEndAt:string|null;
  endEstimated:boolean;endProvenance:string|null;now:string;
}
export interface Provenance {sourceEntityId:string;sourceHash:string;mappingVersion:string;rulesVersion:string;fields:Readonly<Record<string,{origin:'source'|'correction';correctionId?:string}>>}
export interface NormalizedState {resourceKind:'event'|'meeting';name:string;sessionType:SessionType;sessionLabel:string|null;status:NormalizedStatus|null;championshipId:string|null;circuitId:string|null;season:number|null;round:string|null;startsAt:string|null;endsAt:string|null;timezone:string|null;presence:Presence;finalization:'provider_explicit'|'trustworthy_source_end'|'estimated_internal'|'unresolved';finalizationAnomaly:boolean;provenance:Provenance}
export interface MatchCandidate {id:string;championshipId:string;season:number|null;meetingId:string|null;sessionType:SessionType;startsAt:string|null;circuitId:string|null;name:string;round:string|null}
export interface Resolution {decision:Decision;targetId:string|null;score:number|null;signals:readonly string[];reason:string}

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>[k,canonical(v)]));
  return value;
}
export const canonicalJson=(value:unknown)=>JSON.stringify(canonical(value));
export const stableHash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
export function stableUuid(namespace:string,value:unknown){
  const bytes=createHash('sha1').update(namespace).update('\0').update(canonicalJson(value)).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function boundedText(value:unknown,max=512){if(value==null)return null;if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('normalization_text_invalid');return value.trim();}
function setPath(target:Record<string,unknown>,path:string,value:unknown){const parts=path.split('.');if(!parts.length||parts.some(part=>forbiddenKeys.has(part)||!/^[A-Za-z0-9_-]+$/.test(part)))throw new Error('normalization_correction_path_invalid');let cursor=target;for(const part of parts.slice(0,-1)){const current=cursor[part];if(current==null)cursor[part]={};else if(typeof current!=='object'||Array.isArray(current))throw new Error('normalization_correction_path_invalid');cursor=cursor[part] as Record<string,unknown>;}cursor[parts.at(-1)!]=value;}
export function effectiveInput(source:Readonly<Record<string,unknown>>,corrections:readonly Correction[]){
  const result=structuredClone(source) as Record<string,unknown>,applied:Record<string,string>={};
  for(const correction of [...corrections].filter(item=>item.active).sort((a,b)=>a.fieldPath.localeCompare(b.fieldPath,'en')||a.id.localeCompare(b.id,'en'))){setPath(result,correction.fieldPath,structuredClone(correction.value));applied[correction.fieldPath]=correction.id;}
  return {data:result,applied};
}
function iso(value:unknown){if(value==null)return null;if(typeof value!=='string'||value.length>64||!/(Z|[+-]\d\d:\d\d)$/.test(value))throw new Error('normalization_timestamp_requires_offset');const date=new Date(value);if(Number.isNaN(date.valueOf()))throw new Error('normalization_timestamp_invalid');return date.toISOString();}
function mapping(map:Readonly<Record<string,string>>,value:unknown){const key=boundedText(value,256);return key===null?null:map[key]??null;}
function sourceField(data:Readonly<Record<string,unknown>>,key:string){return data[key];}
function presenceOf(input:SourceEnvelope):Presence{if(input.observation==='present')return 'seen';if(input.observation==='not_observed'&&input.traversalComplete)return 'not_observed';if(new Date(input.now).valueOf()>new Date(input.lastObservedAt).valueOf()+7*86400000)return 'stale';return 'unknown';}
export function mapSource(input:SourceEnvelope,config:MappingConfig):NormalizedState{
  if(Buffer.byteLength(canonicalJson(input.data),'utf8')>262144)throw new Error('normalization_source_too_large');
  const {data,applied}=effectiveInput(input.data,input.corrections),fields:Record<string,{origin:'source'|'correction';correctionId?:string}>={};
  const mark=(field:string)=>{const id=applied[field];fields[field]=id?{origin:'correction',correctionId:id}:{origin:'source'};};
  for(const field of ['name','session_type','status','championship_id','circuit_id','starts_at','ends_at','timezone','round'])mark(field);
  const rawType=boundedText(sourceField(data,'session_type'),128),sessionType=rawType?(config.sessionTypes[rawType]??'other'):'other';
  const rawStatus=boundedText(sourceField(data,'status'),128),status=rawStatus?(config.statuses[rawStatus]??null):null;
  const championshipId=mapping(config.championshipIds,sourceField(data,'championship_id')??input.championshipSourceId);
  const circuitId=mapping(config.circuitIds,sourceField(data,'circuit_id'));
  const startsAt=iso(sourceField(data,'starts_at')??input.providerStartedAt),sourceEnd=iso(sourceField(data,'ends_at')??input.providerEndedAt);
  const explicit=status==='completed'||status==='cancelled',endReliable=sourceEnd!==null&&!input.endEstimated;
  const theoretical=input.theoreticalEndAt?iso(input.theoreticalEndAt):null,now=new Date(input.now).valueOf();
  const anomaly=!explicit&&theoretical!==null&&now>=new Date(theoretical).valueOf()+30*86400000;
  return {resourceKind:input.kind,name:boundedText(sourceField(data,'name'))??'Unnamed',sessionType,sessionLabel:sessionType==='other'?rawType:null,status,championshipId,circuitId,season:input.season,round:boundedText(sourceField(data,'round'),128),startsAt,endsAt:endReliable?sourceEnd:null,timezone:boundedText(sourceField(data,'timezone'),128),presence:presenceOf(input),finalization:explicit?'provider_explicit':endReliable?'trustworthy_source_end':theoretical&&input.endEstimated?'estimated_internal':'unresolved',finalizationAnomaly:anomaly,provenance:{sourceEntityId:input.id,sourceHash:input.sourceHash,mappingVersion:config.version,rulesVersion:config.rulesVersion,fields}};
}
function incompatible(state:NormalizedState,candidate:MatchCandidate){return state.championshipId!==candidate.championshipId||state.season!==candidate.season||state.sessionType!==candidate.sessionType||(state.startsAt&&candidate.startsAt&&Math.abs(new Date(state.startsAt).valueOf()-new Date(candidate.startsAt).valueOf())>24*3600000);}
function score(state:NormalizedState,candidate:MatchCandidate){let value=0;const signals:string[]=[];if(state.sessionType===candidate.sessionType){value+=25;signals.push('session_type');}if(state.startsAt&&candidate.startsAt){const minutes=Math.abs(new Date(state.startsAt).valueOf()-new Date(candidate.startsAt).valueOf())/60000;if(minutes<=5){value+=20;signals.push('time_5m');}else if(minutes<=30){value+=16;signals.push('time_30m');}else if(minutes<=120){value+=10;signals.push('time_2h');}else if(minutes<=360){value+=4;signals.push('time_6h');}}if(state.circuitId&&state.circuitId===candidate.circuitId){value+=10;signals.push('circuit');}if(state.name.toLocaleLowerCase('en')===candidate.name.toLocaleLowerCase('en')){value+=5;signals.push('name');}if(state.round&&state.round===candidate.round){value+=5;signals.push('round');}if(candidate.meetingId){value+=35;signals.push('meeting');}return {value,signals};}
export function resolveIdentity(state:NormalizedState,candidates:readonly MatchCandidate[],existingLink:string|null,rejectedTargetIds:readonly string[]=[]):Resolution{
  if(existingLink)return {decision:'linked',targetId:existingLink,score:null,signals:['durable_source_link'],reason:'existing_link'};
  if(state.championshipId===null||state.circuitId===null)return {decision:'review',targetId:null,score:null,signals:[],reason:'required_identity_unknown'};
  const create=():Resolution=>state.startsAt!==null&&state.status!==null?{decision:'create',targetId:null,score:0,signals:[],reason:'no_plausible_candidate'}:{decision:'review',targetId:null,score:null,signals:[],reason:'required_identity_unknown'};
  if(candidates.length>MAX_MATCH_CANDIDATES)throw new Error('normalization_candidate_search_unbounded');
  candidates=candidates.filter(candidate=>!rejectedTargetIds.includes(candidate.id));
  if(state.resourceKind==='meeting'){
    const plausible=candidates.filter(item=>item.championshipId===state.championshipId&&item.season===state.season&&(!state.round||!item.round||item.round===state.round)).sort((a,b)=>a.id.localeCompare(b.id,'en'));
    const roundMatches=state.round?plausible.filter(item=>item.round===state.round):plausible;
    if(roundMatches.length===1)return {decision:'linked',targetId:roundMatches[0].id,score:null,signals:['championship','season',...(state.round?['round']:[])],reason:'deterministic_meeting_identity'};
    if(roundMatches.length>1)return {decision:'review',targetId:null,score:null,signals:['championship','season'],reason:'ambiguous_meeting'};
    return state.startsAt!==null&&state.status!==null?{decision:'create',targetId:null,score:null,signals:[],reason:'no_plausible_meeting'}:{decision:'review',targetId:null,score:null,signals:[],reason:'required_identity_unknown'};
  }
  const ranked=candidates.filter(item=>!incompatible(state,item)).map(item=>({item,...score(state,item)})).sort((a,b)=>b.value-a.value||a.item.id.localeCompare(b.item.id,'en'));
  const first=ranked[0],second=ranked[1];if(!first)return create();
  const structural=first.signals.filter(value=>value!=='name').length,margin=first.value-(second?.value??0);
  if(first.value>=EVENT_AUTO_MATCH_SCORE&&margin>=EVENT_AUTO_MATCH_MARGIN&&structural>=2)return {decision:'linked',targetId:first.item.id,score:first.value,signals:first.signals,reason:'score_and_margin'};
  if(first.value>=EVENT_REVIEW_SCORE||ranked.length>1)return {decision:'review',targetId:null,score:first.value,signals:first.signals,reason:second&&margin<EVENT_AUTO_MATCH_MARGIN?'ambiguous_margin':'insufficient_auto_match'};
  return state.startsAt!==null&&state.status!==null?{decision:'create',targetId:null,score:first.value,signals:first.signals,reason:'below_review_threshold'}:{decision:'review',targetId:null,score:first.value,signals:first.signals,reason:'required_identity_unknown'};
}
export function normalize(input:SourceEnvelope,config:MappingConfig,candidates:readonly MatchCandidate[],existingLink:string|null,rejectedTargetIds:readonly string[]=[]){const state=mapSource(input,config),resolution=resolveIdentity(state,candidates,existingLink,rejectedTargetIds);return {state,resolution,candidateId:stableUuid('mse-normalized-candidate',{sourceId:input.id,sourceHash:input.sourceHash,version:config.version}),proposedUuid:resolution.decision==='create'?stableUuid('mse-normalized-identity',{sourceId:input.id,kind:input.kind}):resolution.targetId,checksum:stableHash({state,resolution})};}
