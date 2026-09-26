import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {pool} from '../lib/db.js';

const fieldPathPattern=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const observationKeyPattern=/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/;
const bounded=(value:string,name:string,max:number)=>{const normalized=value.trim();if(!normalized||normalized.length>max)throw new Error(`${name}_invalid`);return normalized;};
export function validateSourceFieldPath(value:string){if(!fieldPathPattern.test(value))throw new Error('field_path_invalid');return value;}
export function validateObservationKey(value:string){if(!observationKeyPattern.test(value))throw new Error('observation_key_invalid');return value;}
export function assertBoundedProtectionJson(value:unknown){if(Buffer.byteLength(JSON.stringify(value),'utf8')>65536)throw new Error('protection_payload_too_large');return value;}
const sourceValue=(source:unknown,path:string)=>path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'&&!Array.isArray(value)?(value as Record<string,unknown>)[key]:undefined,source);

type Provenance={origin:string;actorId:string;reason?:string|null};
export class SourceProtectionService{
  async upsertCorrection(input:{sourceEntityId:string;fieldPath:string;overrideValue:unknown}&Provenance){return this.transaction(client=>this.upsertCorrectionClient(client,input));}
  async upsertCorrectionClient(client:PoolClient,input:{sourceEntityId:string;fieldPath:string;overrideValue:unknown}&Provenance){
    const fieldPath=validateSourceFieldPath(input.fieldPath),origin=bounded(input.origin,'origin',64),actorId=bounded(input.actorId,'actor_id',256),reason=input.reason==null?null:bounded(input.reason,'reason',2000);assertBoundedProtectionJson(input.overrideValue);
    const entity=(await client.query('select id,source_data from provider_source_entities where id=$1 for update',[input.sourceEntityId])).rows[0];if(!entity)throw new Error('source_entity_not_found');
    const current=(await client.query(`select id from provider_source_corrections where source_entity_id=$1 and field_path=$2 and status='active' for update`,[input.sourceEntityId,fieldPath])).rows[0];
    if(current)return (await client.query(`update provider_source_corrections set override_value=$2::jsonb,reason=$3,origin=$4,actor_id=$5,revision=revision+1,updated_at=now() where id=$1 returning *`,[current.id,JSON.stringify(input.overrideValue),reason,origin,actorId])).rows[0];
    return (await client.query(`insert into provider_source_corrections(id,source_entity_id,field_path,override_value,source_value_at_creation,reason,origin,actor_id) values($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8) returning *`,[randomUUID(),input.sourceEntityId,fieldPath,JSON.stringify(input.overrideValue),JSON.stringify(sourceValue(entity.source_data,fieldPath)??null),reason,origin,actorId])).rows[0];
  }
  async deactivateCorrection(id:string){return this.transaction(async client=>{const correction=(await client.query(`select correction.id from provider_source_corrections correction join provider_source_entities entity on entity.id=correction.source_entity_id where correction.id=$1 and correction.status='active' for update of entity,correction`,[id])).rows[0];if(!correction)throw new Error('active_correction_not_found');return (await client.query(`update provider_source_corrections set status='inactive',deactivated_at=now(),revision=revision+1,updated_at=now() where id=$1 returning *`,[id])).rows[0];});}
  async upsertObservation(input:{sourceEntityId:string;observationKey:string;observationKind:string;details:Record<string,unknown>}&Provenance){return this.transaction(client=>this.upsertObservationClient(client,input));}
  async upsertObservationClient(client:PoolClient,input:{sourceEntityId:string;observationKey:string;observationKind:string;details:Record<string,unknown>}&Provenance){
    const key=validateObservationKey(input.observationKey),kind=bounded(input.observationKind,'observation_kind',128),origin=bounded(input.origin,'origin',64),actorId=bounded(input.actorId,'actor_id',256),reason=input.reason==null?null:bounded(input.reason,'reason',2000);assertBoundedProtectionJson(input.details);
    if(Array.isArray(input.details)||input.details===null)throw new Error('observation_details_invalid');
    const entity=(await client.query('select id from provider_source_entities where id=$1 for update',[input.sourceEntityId])).rows[0];if(!entity)throw new Error('source_entity_not_found');
    return (await client.query(`insert into provider_source_local_observations(id,source_entity_id,observation_key,observation_kind,details,reason,origin,actor_id) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8) on conflict(source_entity_id,observation_key) do update set observation_kind=excluded.observation_kind,details=excluded.details,reason=excluded.reason,origin=excluded.origin,actor_id=excluded.actor_id,revision=provider_source_local_observations.revision+1,updated_at=now() returning *`,[randomUUID(),input.sourceEntityId,key,kind,JSON.stringify(input.details),reason,origin,actorId])).rows[0];
  }
  private async transaction<T>(operation:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('begin');const result=await operation(client);await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}
}
