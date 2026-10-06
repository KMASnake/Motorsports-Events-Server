import { randomUUID } from 'node:crypto';
import type { FastifyInstance,FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool,withTransaction } from '../lib/db.js';
import { markAtomicallyAudited,writeAdminAudit } from '../lib/adminAudit.js';
import type {AdminPrincipal} from '../lib/adminAuth.js';
import { reconciliationChecksum } from '../reconciliation/deterministicReconciliation.js';
import {normalizeFieldValue,ReconciliationFieldValidationError,validatePolicyField} from '../reconciliation/reconciliationFieldContract.js';
import { PostgresReconciliationService,StaleReconciliationPreviewError } from '../reconciliation/postgresReconciliationService.js';
import {CanonicalFieldOverrideService,OverrideConflictError} from '../reconciliation/canonicalFieldOverrideService.js';

const uuid=z.string().uuid();
const kind=z.enum(['meeting','event']);
const fieldClass=z.enum(['STRUCTURAL','SCHEDULE','STATUS','DISPLAY','REFERENCE']);
const rule=z.object({field:z.string().min(1).max(80),class:fieldClass,provider_priority:z.array(z.array(z.string().min(1)).min(1)).min(1),schedule_tolerance_seconds:z.number().int().nonnegative().optional(),stale_after_seconds:z.number().int().positive().optional(),status_rules:z.record(z.string(),z.array(z.string())).optional()}).strict();
const policyBody=z.object({championship_id:z.string().min(1),championship_season_id:uuid.nullable().optional(),resource_kind:kind,rules:z.array(rule).min(1),idempotency_key:z.string().min(1).max(200)}).strict();
const overrideBody=z.object({entity_kind:kind,entity_uuid:uuid,field_name:z.string().min(1).max(80),override_value:z.unknown(),reason:z.string().min(1).max(2000),expected_revision:z.number().int().nonnegative(),idempotency_key:z.string().min(1).max(200)}).strict();
const reconciliation=new PostgresReconciliationService();
const overrides=new CanonicalFieldOverrideService();
const previewBody=z.object({entity_kind:kind,entity_uuid:uuid,policy_id:uuid,evaluation_at:z.string().datetime()}).strict();
const applyBody=previewBody.extend({preview_checksum:z.string().regex(/^[0-9a-f]{64}$/),idempotency_key:z.string().min(1).max(200)}).strict();
const revokeBody=z.object({expected_revision:z.number().int().positive(),idempotency_key:z.string().min(1).max(200),reason:z.string().min(1).max(2000)}).strict();
const actor=(request:FastifyRequest)=>(request as FastifyRequest&{adminPrincipal:AdminPrincipal}).adminPrincipal.sub;

export async function reconciliationRoutes(app:FastifyInstance):Promise<void>{
  app.get('/api/v1/admin/reconciliation/:kind/:id',async(request,reply)=>{
    const parsed=z.object({kind,id:uuid}).safeParse(request.params); if(!parsed.success)return reply.code(400).send({message:'Identité invalide.'});
    const table=parsed.data.kind==='meeting'?'meeting_source_contributions':'event_source_contributions';
    const column=parsed.data.kind==='meeting'?'meeting_id':'event_uuid';
    const [contributions,overrides,conflicts]=await Promise.all([
      pool.query(`select * from ${table} where ${column}=$1 order by observed_at,id`,[parsed.data.id]),
      pool.query(`select * from canonical_field_overrides where entity_kind=$1 and entity_uuid=$2 order by field_name,revision`,[parsed.data.kind,parsed.data.id]),
      pool.query(`select * from reconciliation_conflicts where entity_kind=$1 and entity_uuid=$2 order by field_name,created_at`,[parsed.data.kind,parsed.data.id])]);
    return {contributions:contributions.rows,overrides:overrides.rows,conflicts:conflicts.rows};
  });

  app.post('/api/v1/admin/reconciliation/policies',async(request,reply)=>{
    const parsed=policyBody.safeParse(request.body); if(!parsed.success)return reply.code(400).send({message:'Policy invalide.',issues:parsed.error.issues});
    const body=parsed.data,checksum=reconciliationChecksum(body),id=randomUUID(),actorId=actor(request);
    try{for(const item of body.rules)validatePolicyField(body.resource_kind,item.field,item.class);}catch(error){if(error instanceof ReconciliationFieldValidationError)return reply.code(400).send({message:error.message});throw error;}
    try{const result=await withTransaction(async client=>{
      const replay=await client.query('select * from reconciliation_policies where championship_id=$1 and championship_season_id is not distinct from $2 and resource_kind=$3 and idempotency_key=$4',[body.championship_id,body.championship_season_id??null,body.resource_kind,body.idempotency_key]);
      if(replay.rowCount){if(replay.rows[0].request_fingerprint!==checksum)throw Object.assign(new Error('idempotency_conflict'),{code:'23505'});return replay.rows[0];}
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`reconciliation-policy:${body.championship_id}:${body.championship_season_id??'global'}:${body.resource_kind}`]);
      const version=Number((await client.query('select coalesce(max(version),0)+1 version from reconciliation_policies where championship_id=$1 and championship_season_id is not distinct from $2 and resource_kind=$3',[body.championship_id,body.championship_season_id??null,body.resource_kind])).rows[0].version);
      const created=(await client.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id) values($1,$2,$3,$4,$5,'draft',$6,$7,$6,$8) returning *`,[id,body.championship_id,body.championship_season_id??null,body.resource_kind,version,checksum,body.idempotency_key,actorId])).rows[0];
      for(const item of body.rules)await client.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority,schedule_tolerance_seconds,stale_after_seconds,status_rules) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb)`,[randomUUID(),id,item.field,item.class,JSON.stringify(item.provider_priority),item.schedule_tolerance_seconds??null,item.stale_after_seconds??null,JSON.stringify(item.status_rules??{})]);
      await writeAdminAudit(client,{request,resourceType:'reconciliation-policy',resourceId:id,oldValue:null,newValue:created});
      return created;
    });markAtomicallyAudited(request);return result;}catch(error){if((error as any).code==='23505')return reply.code(409).send({message:'Policy concurrente.'});throw error;}
  });

  app.post('/api/v1/admin/reconciliation/policies/:id/activate',async(request,reply)=>{
    const params=z.object({id:uuid}).safeParse(request.params),body=z.object({expected_status:z.literal('draft')}).strict().safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send({message:'Activation invalide.'});
    try{const result=await withTransaction(async client=>{
      const policy=(await client.query('select * from reconciliation_policies where id=$1 for update',[params.data.id])).rows[0]; if(!policy)return reply.code(404).send({message:'Policy introuvable.'}); if(policy.status!=='draft')return reply.code(409).send({message:'Policy non modifiable.'});
      await client.query(`update reconciliation_policies set status='retired',retired_at=now() where championship_id=$1 and championship_season_id is not distinct from $2 and resource_kind=$3 and status='active'`,[policy.championship_id,policy.championship_season_id,policy.resource_kind]);
      const activated=(await client.query(`update reconciliation_policies set status='active',activated_at=now() where id=$1 returning *`,[policy.id])).rows[0];
      await writeAdminAudit(client,{request,resourceType:'reconciliation-policy',resourceId:policy.id,oldValue:policy,newValue:activated,action:'activate reconciliation policy'});
      return activated;
    });markAtomicallyAudited(request);return result;}catch(error){if((error as any).code==='23505')return reply.code(409).send({message:'Une policy active existe déjà.'});throw error;}
  });

  app.post('/api/v1/admin/reconciliation/overrides',async(request,reply)=>{
    const parsed=overrideBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({message:'Override invalide.',issues:parsed.error.issues});const body=parsed.data;
    try{normalizeFieldValue(body.entity_kind,body.field_name,body.override_value);}catch(error){if(error instanceof ReconciliationFieldValidationError)return reply.code(400).send({message:error.message});throw error;}
    try{const result=await withTransaction(async client=>{
      const mutation=await overrides.setInTransaction(client,{entityKind:body.entity_kind,entityUuid:body.entity_uuid,fieldName:body.field_name,value:body.override_value,reason:body.reason,actorId:actor(request),expectedRevision:body.expected_revision,idempotencyKey:body.idempotency_key}),created=mutation.override;
      await writeAdminAudit(client,{request,resourceType:'canonical-field-override',resourceId:created.id,oldValue:mutation.previous,newValue:created});return created;
    });markAtomicallyAudited(request);return result;}catch(error){if(error instanceof ReconciliationFieldValidationError||['canonical_entity_not_found','canonical_identity_mismatch','identity_override_forbidden'].includes((error as Error).message))return reply.code(400).send({message:(error as Error).message});if(error instanceof OverrideConflictError||['23505','40001'].includes((error as any).code))return reply.code(409).send({message:(error as Error).message});throw error;}
  });

  app.post('/api/v1/admin/reconciliation/overrides/:id/revoke',async(request,reply)=>{
    const params=z.object({id:uuid}).safeParse(request.params),parsed=revokeBody.safeParse(request.body);if(!params.success||!parsed.success)return reply.code(400).send({message:'Révocation invalide.'});const body=parsed.data;
    try{const result=await withTransaction(async client=>{
      const identity=(await client.query('select entity_kind,entity_uuid from canonical_field_overrides where id=$1',[params.data.id])).rows[0];if(!identity)return reply.code(404).send({message:'Override introuvable.'});
      const mutation=await overrides.revokeInTransaction(client,{entityKind:identity.entity_kind,entityUuid:identity.entity_uuid,overrideId:params.data.id,expectedRevision:body.expected_revision,idempotencyKey:body.idempotency_key,reason:body.reason,actorId:actor(request)}),revoked=mutation.override;
      await writeAdminAudit(client,{request,resourceType:'canonical-field-override',resourceId:revoked.id,oldValue:mutation.previous,newValue:revoked});return revoked;
    });markAtomicallyAudited(request);return result;}catch(error){if(error instanceof OverrideConflictError||['23505','40001'].includes((error as any).code))return reply.code(409).send({message:(error as Error).message});throw error;}
  });

  app.post('/api/v1/admin/reconciliation/preview',async(request,reply)=>{
    const parsed=previewBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({message:'Preview invalide.',issues:parsed.error.issues});
    try{return await reconciliation.preview({entityKind:parsed.data.entity_kind,entityUuid:parsed.data.entity_uuid,policyId:parsed.data.policy_id,evaluationAt:parsed.data.evaluation_at});}catch(error){return reply.code(409).send({message:(error as Error).message});}
  });
  app.post('/api/v1/admin/reconciliation/apply',async(request,reply)=>{
    const parsed=applyBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({message:'Apply invalide.',issues:parsed.error.issues});
    try{return await reconciliation.apply({entityKind:parsed.data.entity_kind,entityUuid:parsed.data.entity_uuid,policyId:parsed.data.policy_id,evaluationAt:parsed.data.evaluation_at,previewChecksum:parsed.data.preview_checksum,idempotencyKey:parsed.data.idempotency_key,actorId:actor(request)});}catch(error){if(error instanceof StaleReconciliationPreviewError||['idempotency_conflict'].includes((error as Error).message))return reply.code(409).send({message:(error as Error).message});throw error;}
  });
}
