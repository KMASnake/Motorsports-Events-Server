import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {reconciliationChecksum} from './deterministicReconciliation.js';
import {normalizeFieldValue,validateFieldReferences} from './reconciliationFieldContract.js';
import {legacyEventFieldToReconciliationField} from './legacyEventFieldMapping.js';

type Kind='meeting'|'event';
type Command={entityKind:Kind;entityUuid:string;canonicalRecordId?:string;fieldName:string;actorId:string;reason:string;idempotencyKey:string;expectedRevision:number;value?:unknown;providerValueAtCreation?:unknown;legacyEventCorrectionId?:string|null;legacyStatus?:string|null;compatibilityField?:boolean};
const forbidden=new Set(['id','normalized_uuid','meeting_id','championship_id','championship_season_id']);
export class OverrideConflictError extends Error{constructor(message:'stale_revision'|'idempotency_conflict'|'override_not_found'){super(message);}}

export class CanonicalFieldOverrideService{
  set(command:Command){return withTransaction(client=>this.setInTransaction(client,command));}
  revoke(command:Omit<Command,'fieldName'|'canonicalRecordId'|'value'> & {overrideId:string}){return withTransaction(client=>this.revokeInTransaction(client,command));}

  async lockEntity(client:PoolClient,kind:Kind,uuid:string){await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${kind}:${uuid}`]);}
  private async canonicalRecordId(client:PoolClient,kind:Kind,uuid:string,supplied?:string){const row=kind==='meeting'?(await client.query('select id::text canonical_record_id from meetings where id=$1',[uuid])).rows[0]:(await client.query('select id canonical_record_id from events where normalized_uuid=$1',[uuid])).rows[0];if(!row)throw new Error('canonical_entity_not_found');const actual=String(row.canonical_record_id);if(supplied!==undefined&&supplied!==actual)throw new Error('canonical_identity_mismatch');return actual;}

  async setCompatibleInTransaction(client:PoolClient,input:Omit<Command,'expectedRevision'|'idempotencyKey'> & {legacyOperationId:string}){
    await this.lockEntity(client,input.entityKind,input.entityUuid);
    const current=(await client.query(`select * from canonical_field_overrides where entity_kind=$1 and entity_uuid=$2 and field_name=$3 and status='active' for update`,[input.entityKind,input.entityUuid,input.fieldName])).rows[0];
    if(current&&reconciliationChecksum(current.override_value)===reconciliationChecksum(input.value))return {override:current,previous:current,replay:true};
    const expectedRevision=Number(current?.revision??0);
    const transitionOrdinal=Number((await client.query(`select count(*) count from canonical_override_mutations mutation join canonical_field_overrides override on override.id=mutation.override_id where mutation.entity_kind=$1 and mutation.entity_uuid=$2 and override.field_name=$3`,[input.entityKind,input.entityUuid,input.fieldName])).rows[0].count);
    const idempotencyKey=`legacy:${reconciliationChecksum({operation:'set',entityKind:input.entityKind,entityUuid:input.entityUuid,fieldName:input.fieldName,value:input.value,legacyOperationId:input.legacyOperationId,expectedRevision,transitionOrdinal,actorId:input.actorId,reason:input.reason})}`;
    return this.setLocked(client,{...input,expectedRevision,idempotencyKey,compatibilityField:true},current);
  }

  async revokeCompatibleInTransaction(client:PoolClient,input:Omit<Command,'expectedRevision'|'idempotencyKey'|'fieldName'|'canonicalRecordId'|'value'> & {overrideId:string;legacyOperationId:string}){
    await this.lockEntity(client,input.entityKind,input.entityUuid);
    const current=(await client.query('select * from canonical_field_overrides where id=$1 for update',[input.overrideId])).rows[0];
    if(!current)throw new OverrideConflictError('override_not_found');
    const expectedRevision=Number(current.revision)-(current.status==='revoked'?1:0);
    const idempotencyKey=`legacy:${reconciliationChecksum({operation:'revoke',entityKind:input.entityKind,entityUuid:input.entityUuid,overrideId:input.overrideId,legacyOperationId:input.legacyOperationId,expectedRevision,actorId:input.actorId,reason:input.reason})}`;
    if(current.status==='revoked'){const replay=(await client.query('select result from canonical_override_mutations where entity_kind=$1 and entity_uuid=$2 and idempotency_key=$3',[input.entityKind,input.entityUuid,idempotencyKey])).rows[0];if(replay)return {override:replay.result,replay:true};}
    return this.revokeLocked(client,{...input,expectedRevision,idempotencyKey},current);
  }

  async setInTransaction(client:PoolClient,command:Command){await this.lockEntity(client,command.entityKind,command.entityUuid);const current=(await client.query(`select * from canonical_field_overrides where entity_kind=$1 and entity_uuid=$2 and field_name=$3 and status='active' for update`,[command.entityKind,command.entityUuid,command.fieldName])).rows[0];return this.setLocked(client,command,current);}
  private async setLocked(client:PoolClient,command:Command,current:any){
    if(forbidden.has(command.fieldName))throw new Error('identity_override_forbidden');
    const canonicalRecordId=await this.canonicalRecordId(client,command.entityKind,command.entityUuid,command.canonicalRecordId),logicalField=command.compatibilityField&&command.entityKind==='event'?legacyEventFieldToReconciliationField(command.fieldName):command.fieldName,value=logicalField?normalizeFieldValue(command.entityKind,logicalField,command.value):command.value;if(logicalField)await validateFieldReferences(client,command.entityKind,command.entityUuid,logicalField,value);
    const fingerprint=reconciliationChecksum({...command,operation:'set'}),replay=(await client.query('select * from canonical_override_mutations where entity_kind=$1 and entity_uuid=$2 and idempotency_key=$3',[command.entityKind,command.entityUuid,command.idempotencyKey])).rows[0];
    if(replay){if(replay.request_fingerprint!==fingerprint)throw new OverrideConflictError('idempotency_conflict');return {override:replay.result,previous:current??null,replay:true};}
    if(Number(current?.revision??0)!==command.expectedRevision)throw new OverrideConflictError('stale_revision');
    const revision=command.expectedRevision+1,id=current?.id??randomUUID(),operation=current?'updated':'created';
    const row=current?(await client.query(`update canonical_field_overrides set override_value=$2::jsonb,provider_value_at_creation=coalesce($3::jsonb,provider_value_at_creation),reason=$4,actor_id=$5,revision=$6,idempotency_key=$7,request_fingerprint=$8,legacy_status=coalesce($9,legacy_status),updated_at=now() where id=$1 returning *`,[id,JSON.stringify(value),command.providerValueAtCreation===undefined?null:JSON.stringify(command.providerValueAtCreation),command.reason,command.actorId,revision,command.idempotencyKey,fingerprint,command.legacyStatus??null])).rows[0]:(await client.query(`insert into canonical_field_overrides(id,entity_kind,entity_uuid,canonical_record_id,field_name,override_value,provider_value_at_creation,reason,actor_id,status,revision,idempotency_key,request_fingerprint,legacy_event_correction_id,legacy_status) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,'active',$10,$11,$12,$13,$14) returning *`,[id,command.entityKind,command.entityUuid,canonicalRecordId,command.fieldName,JSON.stringify(value),command.providerValueAtCreation===undefined?null:JSON.stringify(command.providerValueAtCreation),command.reason,command.actorId,revision,command.idempotencyKey,fingerprint,command.legacyEventCorrectionId??null,command.legacyStatus??null])).rows[0];
    await client.query(`insert into canonical_field_override_history(id,override_id,revision,operation,value,actor_id,reason) values($1,$2,$3,$4,$5::jsonb,$6,$7)`,[randomUUID(),id,revision,operation,JSON.stringify(command.value),command.actorId,command.reason]);
    await client.query(`insert into canonical_override_mutations(id,entity_kind,entity_uuid,idempotency_key,request_fingerprint,override_id,operation,resulting_revision,result) values($1,$2,$3,$4,$5,$6,'set',$7,$8::jsonb)`,[randomUUID(),command.entityKind,command.entityUuid,command.idempotencyKey,fingerprint,id,revision,JSON.stringify(row)]);
    return {override:row,previous:current??null,replay:false};
  }

  async revokeInTransaction(client:PoolClient,command:Omit<Command,'fieldName'|'canonicalRecordId'|'value'> & {overrideId:string}){await this.lockEntity(client,command.entityKind,command.entityUuid);const current=(await client.query('select * from canonical_field_overrides where id=$1 for update',[command.overrideId])).rows[0];return this.revokeLocked(client,command,current);}
  async recordProviderObservationInTransaction(client:PoolClient,input:{overrideId:string;entityUuid:string;providerValue:unknown;legacyStatus:string}){
    await this.lockEntity(client,'event',input.entityUuid);
    const current=(await client.query(`select * from canonical_field_overrides where id=$1 and entity_kind='event' and entity_uuid=$2 and status='active' for update`,[input.overrideId,input.entityUuid])).rows[0];if(!current)throw new OverrideConflictError('override_not_found');
    if(reconciliationChecksum(current.provider_value_at_creation)===reconciliationChecksum(input.providerValue)&&current.legacy_status===input.legacyStatus)return current;
    const previousRevision=Number(current.revision),revision=previousRevision+1,observation={providerValue:input.providerValue,legacyStatus:input.legacyStatus},idempotencyKey=`provider-observation:${input.overrideId}:${reconciliationChecksum({operation:'provider_observation',previousRevision,resultingRevision:revision,observation})}`,fingerprint=reconciliationChecksum({...input,operation:'provider_observation',previousRevision,resultingRevision:revision});
    const row=(await client.query(`update canonical_field_overrides set provider_value_at_creation=$2::jsonb,legacy_status=$3,revision=$4,updated_at=now() where id=$1 returning *`,[input.overrideId,JSON.stringify(input.providerValue),input.legacyStatus,revision])).rows[0];
    await client.query(`insert into canonical_field_override_history(id,override_id,revision,operation,value,actor_id,reason) values($1,$2,$3,'provider_observed',$4::jsonb,'provider-sync','Provider observation changed')`,[randomUUID(),input.overrideId,revision,JSON.stringify({overrideValue:current.override_value,providerValue:input.providerValue,legacyStatus:input.legacyStatus,previousRevision:Number(current.revision)})]);
    await client.query(`insert into canonical_override_mutations(id,entity_kind,entity_uuid,idempotency_key,request_fingerprint,override_id,operation,resulting_revision,result) values($1,'event',$2,$3,$4,$5,'provider_observation',$6,$7::jsonb)`,[randomUUID(),input.entityUuid,idempotencyKey,fingerprint,input.overrideId,revision,JSON.stringify(row)]);
    return row;
  }
  private async revokeLocked(client:PoolClient,command:Omit<Command,'fieldName'|'canonicalRecordId'|'value'> & {overrideId:string},current:any){
    const fingerprint=reconciliationChecksum({...command,operation:'revoke'}),replay=(await client.query('select * from canonical_override_mutations where entity_kind=$1 and entity_uuid=$2 and idempotency_key=$3',[command.entityKind,command.entityUuid,command.idempotencyKey])).rows[0];
    if(replay){if(replay.request_fingerprint!==fingerprint)throw new OverrideConflictError('idempotency_conflict');return {override:replay.result,previous:current??null,replay:true};}
    if(!current)throw new OverrideConflictError('override_not_found');if(current.status!=='active'||Number(current.revision)!==command.expectedRevision)throw new OverrideConflictError('stale_revision');
    const revision=command.expectedRevision+1,row=(await client.query(`update canonical_field_overrides set status='revoked',revision=$2,reason=$3,actor_id=$4,revoked_at=now(),updated_at=now() where id=$1 returning *`,[command.overrideId,revision,command.reason,command.actorId])).rows[0];
    await client.query(`insert into canonical_field_override_history(id,override_id,revision,operation,value,actor_id,reason) values($1,$2,$3,'revoked',$4::jsonb,$5,$6)`,[randomUUID(),command.overrideId,revision,JSON.stringify(current.override_value),command.actorId,command.reason]);
    await client.query(`insert into canonical_override_mutations(id,entity_kind,entity_uuid,idempotency_key,request_fingerprint,override_id,operation,resulting_revision,result) values($1,$2,$3,$4,$5,$6,'revoke',$7,$8::jsonb)`,[randomUUID(),command.entityKind,command.entityUuid,command.idempotencyKey,fingerprint,command.overrideId,revision,JSON.stringify(row)]);
    return {override:row,previous:current,replay:false};
  }
}
