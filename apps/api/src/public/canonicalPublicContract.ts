import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {ResourceRow} from '../preview/repository.js';

export const canonicalPublicStatuses=['scheduled','confirmed','postponed','cancelled','completed'] as const;
export const canonicalPublicStatus=z.enum(canonicalPublicStatuses);
export type CanonicalPublicStatus=z.infer<typeof canonicalPublicStatus>;

const uuid=z.string().uuid();
const instant=z.string().datetime({offset:true});
const nullableInstant=z.union([instant,z.null()]);
const canonicalKey=z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/);

export const championshipPublicSchema=z.object({
  id:uuid,legacy_id:canonicalKey,revision:z.number().int().positive(),name:z.string().nullable(),slug:z.string().nullable(),
  short_name:z.string().nullable(),official_name:z.string().nullable(),category:z.string().nullable(),
  discipline:z.object({key:z.string(),label:z.string().nullable(),family_key:z.string().nullable()}).nullable(),
  season:z.number().int().nullable(),logo_url:z.string().nullable(),description:z.string().nullable(),
  availability:z.string(),last_updated_at:instant
}).strict();

export const championshipSeasonPublicSchema=z.object({
  id:uuid,championship_id:uuid,key:z.string(),label:z.string(),start_year:z.number().int().nullable(),
  end_year:z.number().int().nullable(),starts_on:z.string().nullable(),ends_on:z.string().nullable()
}).strict();

export const venuePublicSchema=z.object({
  id:uuid,key:z.string(),name:z.string(),kind_key:z.string(),city:z.string().nullable(),region:z.string().nullable(),
  country_code:z.string().nullable(),timezone:z.string().nullable(),latitude:z.number().nullable(),longitude:z.number().nullable()
}).strict();

export const venueLayoutPublicSchema=z.object({id:uuid,venue_id:uuid,key:z.string(),name:z.string()}).strict();
export const sessionTypePublicSchema=z.object({key:z.string(),label:z.string(),sort_order:z.number().int(),active:z.boolean()}).strict();
const meetingSessionPublicSchema=z.object({id:uuid,type_key:z.string(),title:z.string().nullable(),status:canonicalPublicStatus,starts_at:z.union([instant,z.null()]),ends_at:nullableInstant}).strict();

const canonicalResourceCommon={
  id:uuid,revision:z.number().int().positive(),name:z.string().nullable(),starts_at:z.union([instant,z.null()]),
  ends_at:nullableInstant,timezone:z.string().nullable(),last_updated_at:instant
};
export const meetingPublicSchema=z.object({
  ...canonicalResourceCommon,
  championship:z.object({id:canonicalKey,canonical_id:uuid}),championship_season_id:z.union([uuid,z.null()]),
  season:z.number().int().nullable(),round:z.string().nullable(),venue_id:z.union([uuid,z.null()]),
  venue_layout_id:z.union([uuid,z.null()]),legacy_circuit_id:z.string().nullable(),
  venue:z.object({id:z.string()}).nullable(),data_quality:z.object({freshness:z.string()}),sessions:z.array(meetingSessionPublicSchema)
}).strict();
export const eventPublicSchema=z.object({
  ...canonicalResourceCommon,
  championship:z.object({id:canonicalKey,canonical_id:uuid}),championship_season_id:z.union([uuid,z.null()]),
  meeting_id:z.union([uuid,z.null()]),venue_id:z.union([uuid,z.null()]),venue_layout_id:z.union([uuid,z.null()]),
  legacy_circuit_id:z.string().nullable(),venue:z.object({id:z.string()}).nullable(),
  session:z.object({type:z.string(),type_key:z.string(),name:z.string().nullable(),title:z.string().nullable()}),
  status:canonicalPublicStatus,data_quality:z.object({freshness:z.string()})
}).strict();

// Stable namespace owned by the canonical public contract. The legacy Championship
// key remains unchanged; this UUID is its additive versioned-publication identity.
const CHAMPIONSHIP_PUBLIC_NAMESPACE='motorsports-events:public-championship:v1:';
export function championshipPublicId(legacyId:string){
  const canonicalId=canonicalKey.parse(legacyId);
  const bytes=createHash('sha256').update(CHAMPIONSHIP_PUBLIC_NAMESPACE).update(canonicalId).digest().subarray(0,16);
  bytes[6]=(bytes[6]!&0x0f)|0x80;bytes[8]=(bytes[8]!&0x3f)|0x80;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

const stringOrNull=(value:unknown)=>typeof value==='string'?value:null;
const numberOrNull=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const uuidOrNull=(value:unknown)=>typeof value==='string'&&uuid.safeParse(value).success?value:null;
const requiredString=(value:unknown,name:string)=>{if(typeof value!=='string'||!value.trim())throw new Error(`canonical_public_${name}_required`);return value;};
const timezone=(value:unknown)=>typeof value==='string'&&value.length?value:null;
const instantOrNull=(value:unknown)=>value==null?null:instant.parse(value);
const meetingSessions=(value:unknown)=>Array.isArray(value)?value.map(item=>{const session=item as Record<string,unknown>;return meetingSessionPublicSchema.parse({id:session.id,type_key:session.type_key??session.sessionType,title:stringOrNull(session.title??session.name),status:session.status,starts_at:instantOrNull(session.starts_at??session.startsAt),ends_at:instantOrNull(session.ends_at??session.endsAt)});}):[];

export function serializeChampionshipSeason(value:Record<string,unknown>){return championshipSeasonPublicSchema.parse({
  id:value.id,championship_id:championshipPublicId(requiredString(value.championship_id,'championship_id')),
  key:value.key,label:value.label,start_year:numberOrNull(value.start_year),end_year:numberOrNull(value.end_year),
  starts_on:stringOrNull(value.starts_on),ends_on:stringOrNull(value.ends_on)
});}
export function serializeVenue(value:Record<string,unknown>){return venuePublicSchema.parse({
  id:value.id,key:value.key,name:value.name,kind_key:value.kind_key,city:stringOrNull(value.city),region:stringOrNull(value.region),
  country_code:stringOrNull(value.country_code),timezone:stringOrNull(value.timezone),latitude:numberOrNull(value.latitude),longitude:numberOrNull(value.longitude)
});}
export function serializeVenueLayout(value:Record<string,unknown>){return venueLayoutPublicSchema.parse({id:value.id,venue_id:value.venue_id,key:value.key,name:value.name});}
export function serializeSessionType(value:Record<string,unknown>){return sessionTypePublicSchema.parse({key:value.key,label:value.label,sort_order:value.sort_order,active:value.active});}

export type CanonicalPublicOrderKind='championship'|'championshipSeason'|'venue'|'venueLayout'|'meeting'|'event'|'sessionType';
export function compareCanonicalPublic(kind:CanonicalPublicOrderKind,left:Record<string,unknown>,right:Record<string,unknown>){
  const value=(item:Record<string,unknown>)=>kind==='sessionType'?[Number(item.sort_order??0),String(item.key??'')]:kind==='championshipSeason'?[Number(item.start_year??0),String(item.key??''),String(item.id??'')]:kind==='meeting'||kind==='event'?[String(item.starts_at??''),String(item.id??'')]:[String(item.name??''),String(item.id??item.key??'')];
  const a=value(left),b=value(right);for(let index=0;index<Math.max(a.length,b.length);index++){const l=a[index],r=b[index];if(typeof l==='number'&&typeof r==='number'&&l!==r)return l-r;const compared=String(l??'').localeCompare(String(r??''),'en');if(compared)return compared;}return 0;
}

export function serializePublishedResource(row:ResourceRow){
  const state=row.state??{},common={id:row.resourceId,revision:row.revision,name:stringOrNull(state.name),starts_at:instantOrNull(state.startsAt),ends_at:instantOrNull(state.endsAt),timezone:timezone(state.timezone),last_updated_at:instant.parse(row.promotedAt)};
  if(row.resourceType==='championship'){
    const legacyId=requiredString(state.championshipId??state.legacyId,'championship_id');
    if(row.resourceId!==championshipPublicId(legacyId))throw new Error('canonical_public_championship_identity_mismatch');
    return championshipPublicSchema.parse({id:common.id,revision:common.revision,name:common.name,last_updated_at:common.last_updated_at,legacy_id:legacyId,slug:stringOrNull(state.slug),short_name:stringOrNull(state.shortName),official_name:stringOrNull(state.officialName),category:stringOrNull(state.category),discipline:state.disciplineKey?{key:state.disciplineKey,label:stringOrNull(state.disciplineLabel),family_key:stringOrNull(state.disciplineFamilyKey)}:null,season:numberOrNull(state.season),logo_url:stringOrNull(state.logoUrl),description:stringOrNull(state.description),availability:stringOrNull(state.availability)??'preview'});
  }
  if(row.resourceType==='championshipSeason')return serializeChampionshipSeason({...state,id:row.resourceId});
  if(row.resourceType==='venue')return serializeVenue({...state,id:row.resourceId});
  if(row.resourceType==='venueLayout')return serializeVenueLayout({...state,id:row.resourceId});
  const legacyChampionshipId=requiredString(state.championshipId,'championship_id'),championship={id:legacyChampionshipId,canonical_id:championshipPublicId(legacyChampionshipId)};
  const venueId=uuidOrNull(state.venueId),venueLayoutId=uuidOrNull(state.venueLayoutId),legacyCircuitId=stringOrNull(state.circuitId),legacyVenue=legacyCircuitId?{id:legacyCircuitId}:null;
  if(row.resourceType==='meeting')return meetingPublicSchema.parse({...common,championship,championship_season_id:uuidOrNull(state.championshipSeasonId),season:numberOrNull(state.season),round:stringOrNull(state.round),venue_id:venueId,venue_layout_id:venueLayoutId,legacy_circuit_id:legacyCircuitId,venue:legacyVenue,data_quality:{freshness:stringOrNull(state.presence)??'unknown'},sessions:meetingSessions(state.sessions)});
  const status=canonicalPublicStatus.parse(state.status);
  const title=stringOrNull(state.sessionLabel)??stringOrNull(state.name);
  return eventPublicSchema.parse({...common,championship,championship_season_id:uuidOrNull(state.championshipSeasonId),meeting_id:uuidOrNull(state.meetingId),venue_id:venueId,venue_layout_id:venueLayoutId,legacy_circuit_id:legacyCircuitId,venue:legacyVenue,session:{type:requiredString(state.sessionType,'session_type'),type_key:requiredString(state.sessionType,'session_type'),name:title,title},status,data_quality:{freshness:stringOrNull(state.presence)??'unknown'}});
}
