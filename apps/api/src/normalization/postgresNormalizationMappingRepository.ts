import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db.js';
import type { MappingConfig, NormalizedStatus, SessionType } from './deterministicNormalization.js';

const sessionTypes=new Set<SessionType>(['practice','qualifying','sprint_qualifying','sprint','race','other']);
const statuses=new Set<NormalizedStatus>(['scheduled','confirmed','postponed','cancelled','completed']);
const unsafeKeys=new Set(['__proto__','prototype','constructor']);
const documentKeys=['championshipIds','circuitIds','sessionTypes','statuses'] as const;
type MappingDocument={championshipIds:Record<string,string>;circuitIds:Record<string,string>;sessionTypes:Record<string,SessionType>;statuses:Record<string,NormalizedStatus>};
type MappingRow={id:string;provider_championship_id:string;version_label:string;rules_version:string;mapping_document:unknown;created_at:Date|string;created_by:string};
export type NormalizationMappingVersion={id:string;providerChampionshipId:string;versionLabel:string;rulesVersion:string;mappingDocument:MappingDocument;createdAt:string;createdBy:string};

export class NormalizationMappingRepositoryError extends Error{
  constructor(readonly code:'mapping_not_found'|'active_mapping_absent'|'traversal_mapping_absent'|'ownership_mismatch'|'binding_conflict'|'malformed_mapping',message:string){super(message);}
}

function dictionary(value:unknown,allowed?:ReadonlySet<string>):Record<string,string>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new NormalizationMappingRepositoryError('malformed_mapping','Mapping section must be an object.');
  const result:Record<string,string>={};
  for(const [key,target] of Object.entries(value)){
    if(!key.trim()||key.length>256||unsafeKeys.has(key)||typeof target!=='string'||!target.trim()||target.length>256||allowed&&!allowed.has(target))throw new NormalizationMappingRepositoryError('malformed_mapping','Mapping section contains an invalid entry.');
    result[key]=target;
  }
  return result;
}

export function parseNormalizationMappingDocument(value:unknown):MappingDocument{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new NormalizationMappingRepositoryError('malformed_mapping','Mapping document must be an object.');
  const row=value as Record<string,unknown>,keys=Object.keys(row).sort();
  if(JSON.stringify(keys)!==JSON.stringify([...documentKeys].sort()))throw new NormalizationMappingRepositoryError('malformed_mapping','Mapping document keys are invalid.');
  return {
    championshipIds:dictionary(row.championshipIds),
    circuitIds:dictionary(row.circuitIds),
    sessionTypes:dictionary(row.sessionTypes,sessionTypes) as Record<string,SessionType>,
    statuses:dictionary(row.statuses,statuses) as Record<string,NormalizedStatus>
  };
}

function mapping(row:MappingRow):NormalizationMappingVersion{return {id:String(row.id),providerChampionshipId:String(row.provider_championship_id),versionLabel:String(row.version_label),rulesVersion:String(row.rules_version),mappingDocument:parseNormalizationMappingDocument(row.mapping_document),createdAt:new Date(row.created_at).toISOString(),createdBy:String(row.created_by)};}
export function mappingConfigFromVersion(value:NormalizationMappingVersion):MappingConfig{return {version:`mapping:${value.id}`,rulesVersion:value.rulesVersion,championshipIds:{...value.mappingDocument.championshipIds},circuitIds:{...value.mappingDocument.circuitIds},sessionTypes:{...value.mappingDocument.sessionTypes},statuses:{...value.mappingDocument.statuses}};}

async function transaction<T>(operation:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('begin');const result=await operation(client);await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}

export class PostgresNormalizationMappingRepository{
  async createMappingVersion(input:{providerChampionshipId:string;versionLabel:string;rulesVersion:string;mappingDocument:MappingDocument;actor:string}){
    const document=parseNormalizationMappingDocument(input.mappingDocument),id=randomUUID();
    const row=(await pool.query<MappingRow>(`insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values($1,$2,$3,$4,$5::jsonb,$6) returning *`,[id,input.providerChampionshipId,input.versionLabel,input.rulesVersion,JSON.stringify(document),input.actor])).rows[0];
    return mapping(row!);
  }
  async getMappingVersion(id:string,client:PoolClient|typeof pool=pool){const row=(await client.query<MappingRow>('select * from normalization_mapping_versions where id=$1',[id])).rows[0];return row?mapping(row):null;}
  async listMappingVersions(providerChampionshipId:string){return (await pool.query<MappingRow>('select * from normalization_mapping_versions where provider_championship_id=$1 order by created_at,id',[providerChampionshipId])).rows.map(mapping);}
  async getActiveMapping(providerChampionshipId:string){const row=(await pool.query<MappingRow>(`select version.* from provider_championship_active_normalization_mappings active join normalization_mapping_versions version on version.id=active.mapping_version_id and version.provider_championship_id=active.provider_championship_id where active.provider_championship_id=$1`,[providerChampionshipId])).rows[0];return row?mapping(row):null;}
  async getTraversalMapping(traversalId:string){const row=(await pool.query<MappingRow>(`select version.* from provider_acquisition_traversal_mappings binding join normalization_mapping_versions version on version.id=binding.mapping_version_id and version.provider_championship_id=binding.provider_championship_id where binding.traversal_id=$1`,[traversalId])).rows[0];return row?mapping(row):null;}
  async activateMapping(providerChampionshipId:string,mappingVersionId:string,actor:string){return transaction(async client=>{
    if(!(await client.query('select id from provider_championships where id=$1 for update',[providerChampionshipId])).rowCount)throw new NormalizationMappingRepositoryError('mapping_not_found','Provider championship not found.');
    const version=await this.getMappingVersion(mappingVersionId,client);if(!version)throw new NormalizationMappingRepositoryError('mapping_not_found','Mapping version not found.');
    if(version.providerChampionshipId!==providerChampionshipId)throw new NormalizationMappingRepositoryError('ownership_mismatch','Mapping version belongs to another provider championship.');
    await client.query(`insert into provider_championship_active_normalization_mappings(provider_championship_id,mapping_version_id,activated_at,activated_by) values($1,$2,now(),$3) on conflict(provider_championship_id) do update set mapping_version_id=excluded.mapping_version_id,activated_at=excluded.activated_at,activated_by=excluded.activated_by`,[providerChampionshipId,mappingVersionId,actor]);return version;
  });}
  async bindTraversalMapping(traversalId:string,mappingVersionId:string){return transaction(async client=>{
    const traversal=(await client.query(`select stream.provider_championship_id from provider_acquisition_traversals traversal join sync_streams stream on stream.id=traversal.stream_id where traversal.id=$1 for update of traversal`,[traversalId])).rows[0];
    if(!traversal)throw new NormalizationMappingRepositoryError('mapping_not_found','Traversal not found.');
    const existing=(await client.query('select mapping_version_id from provider_acquisition_traversal_mappings where traversal_id=$1',[traversalId])).rows[0];
    if(existing){if(String(existing.mapping_version_id)!==mappingVersionId)throw new NormalizationMappingRepositoryError('binding_conflict','Traversal is already bound to another mapping.');return (await this.getMappingVersion(mappingVersionId,client))!;}
    const version=await this.getMappingVersion(mappingVersionId,client);if(!version)throw new NormalizationMappingRepositoryError('mapping_not_found','Mapping version not found.');
    if(version.providerChampionshipId!==String(traversal.provider_championship_id))throw new NormalizationMappingRepositoryError('ownership_mismatch','Traversal and mapping ownership differ.');
    await client.query('insert into provider_acquisition_traversal_mappings(traversal_id,provider_championship_id,mapping_version_id) values($1,$2,$3)',[traversalId,traversal.provider_championship_id,mappingVersionId]);return version;
  });}
  async resolveMappingConfig(mappingVersionId:string){const version=await this.getMappingVersion(mappingVersionId);if(!version)throw new NormalizationMappingRepositoryError('mapping_not_found','Mapping version not found.');return mappingConfigFromVersion(version);}
  async resolveActiveMappingConfig(providerChampionshipId:string){const version=await this.getActiveMapping(providerChampionshipId);if(!version)throw new NormalizationMappingRepositoryError('active_mapping_absent','No active mapping exists.');return mappingConfigFromVersion(version);}
  async resolveTraversalMappingConfig(traversalId:string){const version=await this.getTraversalMapping(traversalId);if(!version)throw new NormalizationMappingRepositoryError('traversal_mapping_absent','Traversal has no mapping binding.');return mappingConfigFromVersion(version);}
}
