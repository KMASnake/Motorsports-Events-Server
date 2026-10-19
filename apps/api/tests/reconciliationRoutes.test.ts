import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const clientQuery=vi.hoisted(()=>vi.fn());
const poolQuery=vi.hoisted(()=>vi.fn());
const preview=vi.hoisted(()=>vi.fn());
const apply=vi.hoisted(()=>vi.fn());
const setOverride=vi.hoisted(()=>vi.fn());
const revokeOverride=vi.hoisted(()=>vi.fn());

vi.mock('../src/lib/db.js',()=>({
  pool:{query:poolQuery},
  withTransaction:vi.fn(async(operation:(client:{query:typeof clientQuery})=>unknown)=>operation({query:clientQuery}))
}));
vi.mock('../src/reconciliation/postgresReconciliationService.js',()=>{
  class StaleReconciliationPreviewError extends Error{constructor(){super('stale_reconciliation_preview');}}
  return {StaleReconciliationPreviewError,PostgresReconciliationService:class{preview=preview;apply=apply;}};
});
vi.mock('../src/reconciliation/canonicalFieldOverrideService.js',()=>{
  class OverrideConflictError extends Error{}
  return {OverrideConflictError,CanonicalFieldOverrideService:class{setInTransaction=setOverride;revokeInTransaction=revokeOverride;}};
});
vi.mock('../src/lib/adminSession.js',async importOriginal=>({...await importOriginal<typeof import('../src/lib/adminSession.js')>(),validateHumanSession:vi.fn()}));

import {registerAdminAuth,signAdminToken} from '../src/lib/adminAuth.js';
import {createCsrfToken,validateHumanSession} from '../src/lib/adminSession.js';
import {reconciliationRoutes} from '../src/routes/reconciliation.js';
import {OverrideConflictError} from '../src/reconciliation/canonicalFieldOverrideService.js';
import {ReconciliationFieldValidationError} from '../src/reconciliation/reconciliationFieldContract.js';
import {StaleReconciliationPreviewError} from '../src/reconciliation/postgresReconciliationService.js';

const secret='f5-reconciliation-admin-secret-at-least-32-characters';
const origin='http://admin.test';
const admin=signAdminToken({sub:'maintainer',role:'admin',exp:Math.floor(Date.now()/1000)+3600},secret);
const viewer=signAdminToken({sub:'viewer',role:'viewer',exp:Math.floor(Date.now()/1000)+3600},secret);
const entityUuid='57000000-0000-4000-8000-000000000099';
const policyId='57000000-0000-4000-8000-000000000098';
const overrideId='57000000-0000-4000-8000-000000000097';

async function secured(){
  const app=Fastify();
  registerAdminAuth(app,secret,{cookie:{secure:false,sessionName:'mse_admin_session',csrfName:'mse_admin_csrf'},sessionSecret:secret,webOrigin:origin});
  await app.register(reconciliationRoutes);
  return app;
}

const applyPayload={entity_kind:'event',entity_uuid:entityUuid,policy_id:policyId,evaluation_at:'2026-09-27T10:00:00.000Z',preview_checksum:'a'.repeat(64),idempotency_key:'apply-1'};

describe('F5-6 reconciliation admin API security and mutation contract',()=>{
  beforeEach(()=>{
    clientQuery.mockReset();poolQuery.mockReset();preview.mockReset();apply.mockReset();setOverride.mockReset();revokeOverride.mockReset();
    poolQuery.mockResolvedValue({rowCount:0,rows:[]});
    preview.mockResolvedValue({previewChecksum:'a'.repeat(64)});
    apply.mockResolvedValue({outcome:'applied',replay:false});
    setOverride.mockResolvedValue({override:{id:overrideId},previous:null,replay:false});
    revokeOverride.mockResolvedValue({override:{id:overrideId,status:'revoked'},previous:{id:overrideId,status:'active'},replay:false});
  });
  afterEach(()=>vi.mocked(validateHumanSession).mockReset());

  it('requires authentication and the admin role for reconciliation endpoints',async()=>{
    const app=await secured();
    expect((await app.inject({url:`/api/v1/admin/reconciliation/event/${entityUuid}`})).statusCode).toBe(401);
    expect((await app.inject({url:`/api/v1/admin/reconciliation/event/${entityUuid}`,headers:{authorization:`Bearer ${viewer}`}})).statusCode).toBe(403);
    expect((await app.inject({url:`/api/v1/admin/reconciliation/event/${entityUuid}`,headers:{authorization:`Bearer ${admin}`}})).statusCode).toBe(200);
    await app.close();
  });

  it('enforces CSRF for a human-session mutation path',async()=>{
    const session={id:'f56-session',username:'maintainer',idleExpiresAt:new Date(Date.now()+60000),absoluteExpiresAt:new Date(Date.now()+60000)};
    vi.mocked(validateHumanSession).mockResolvedValue(session);
    const csrf=createCsrfToken(session.id,secret),cookie=`mse_admin_session=opaque; mse_admin_csrf=${csrf}`,app=await secured();
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/preview',headers:{cookie,origin},payload:applyPayload})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/preview',headers:{cookie,origin,'x-csrf-token':csrf},payload:{entity_kind:'event',entity_uuid:entityUuid,policy_id:policyId,evaluation_at:applyPayload.evaluation_at}})).statusCode).toBe(200);
    await app.close();
  });

  it('rejects unbounded, unknown, structural, and malformed mutation payloads',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/apply',headers,payload:{...applyPayload,unexpected:true}})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{entity_kind:'event',entity_uuid:entityUuid,canonical_record_id:'event-1',field_name:'meeting_id',override_value:'forbidden',reason:'x',expected_revision:0,idempotency_key:'x'}})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/policies',headers,payload:{championship_id:'f1',resource_kind:'event',idempotency_key:'x'.repeat(201),rules:[]}})).statusCode).toBe(400);
    expect(apply).not.toHaveBeenCalled();expect(setOverride).not.toHaveBeenCalled();
    await app.close();
  });

  it('maps stale override revisions and stale reconciliation previews to conflicts',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    setOverride.mockRejectedValueOnce(new OverrideConflictError('stale_revision'));
    const override=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{entity_kind:'event',entity_uuid:entityUuid,field_name:'name',override_value:'Admin',reason:'Reviewed',expected_revision:1,idempotency_key:'override-1'}});
    expect(override.statusCode).toBe(409);
    apply.mockRejectedValueOnce(new StaleReconciliationPreviewError());
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/apply',headers,payload:applyPayload})).statusCode).toBe(409);
    await app.close();
  });

  it('derives mutation actors from authentication and atomically audits policies',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    clientQuery.mockImplementation(async(sql:string,args?:unknown[])=>{
      if(sql.startsWith('select * from reconciliation_policies where championship_id'))return {rowCount:0,rows:[]};
      if(sql.startsWith('select coalesce(max(version)'))return {rowCount:1,rows:[{version:1}]};
      if(sql.startsWith('insert into reconciliation_policies'))return {rowCount:1,rows:[{id:policyId,actor_id:args?.[7],status:'draft'}]};
      return {rowCount:1,rows:[]};
    });
    const response=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/policies',headers,payload:{championship_id:'f1',resource_kind:'event',idempotency_key:'policy-1',rules:[{field:'name',class:'DISPLAY',provider_priority:[['provider-a']]}]}});
    expect(response.statusCode).toBe(200);expect(response.json().actor_id).toBe('maintainer');
    expect(clientQuery.mock.calls.some(([sql,args])=>String(sql).includes('pg_advisory_xact_lock')&&String((args as unknown[])[0])==='reconciliation-policy:f1:global:event')).toBe(true);
    expect(clientQuery.mock.calls.some(([sql,args])=>String(sql).includes('insert into admin_audit_log')&&(args as unknown[])[0]==='maintainer')).toBe(true);
    await app.close();
  });

  it('rejects unsupported policy and override fields before persistence',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    const policy=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/policies',headers,payload:{championship_id:'f1',resource_kind:'event',idempotency_key:'policy-unsupported',rules:[{field:'unsupported',class:'DISPLAY',provider_priority:[['provider-a']]}]}});
    const override=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{entity_kind:'event',entity_uuid:entityUuid,field_name:'unsupported',override_value:'x',reason:'Reviewed',expected_revision:0,idempotency_key:'override-unsupported'}});
    expect(policy.statusCode).toBe(400);expect(override.statusCode).toBe(400);expect(clientQuery).not.toHaveBeenCalled();expect(setOverride).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns deterministic 4xx for every invalid field type and policy class',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`},base={entity_kind:'event',entity_uuid:entityUuid,reason:'validation',expected_revision:0,idempotency_key:'validation'};
    for(const [field,value] of [['name',42],['sessionLabel',{}],['sessionType',null],['startsAt','not-a-date'],['endsAt',false],['status','unknown'],['venueId','not-a-uuid'],['venueLayoutId',17],['meeting_id','x']] as const){const response=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{...base,field_name:field,override_value:value,idempotency_key:`validation-${field}`}});expect(response.statusCode).toBe(400);}
    const meetingStatus=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{...base,entity_kind:'meeting',field_name:'status',override_value:'scheduled'}});expect(meetingStatus.statusCode).toBe(400);
    const oversized=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{...base,field_name:'name',override_value:'x'.repeat(256)}});expect(oversized.statusCode).toBe(400);
    const wrongClass=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/policies',headers,payload:{championship_id:'f1',resource_kind:'event',idempotency_key:'wrong-class',rules:[{field:'status',class:'DISPLAY',provider_priority:[['provider-a']]}]}});expect(wrongClass.statusCode).toBe(400);
    expect(setOverride).not.toHaveBeenCalled();await app.close();
  });

  it('maps transactional reference validation failures to 4xx without mutation success',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    setOverride.mockRejectedValueOnce(new ReconciliationFieldValidationError('venue_not_found'));
    const response=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/overrides',headers,payload:{entity_kind:'event',entity_uuid:entityUuid,field_name:'venueId',override_value:'57000000-0000-4000-8000-000000000096',reason:'validation',expected_revision:0,idempotency_key:'missing-venue'}});
    expect(response.statusCode).toBe(400);expect(response.json()).toEqual({message:'venue_not_found'});
    await app.close();
  });

  it('preserves idempotent apply replay and rejects divergent idempotency',async()=>{
    const app=await secured(),headers={authorization:`Bearer ${admin}`};
    apply.mockResolvedValueOnce({outcome:'applied',replay:false}).mockResolvedValueOnce({outcome:'applied',replay:true}).mockRejectedValueOnce(new Error('idempotency_conflict'));
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/apply',headers,payload:applyPayload})).json()).toMatchObject({replay:false});
    expect((await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/apply',headers,payload:applyPayload})).json()).toMatchObject({replay:true});
    const divergent=await app.inject({method:'POST',url:'/api/v1/admin/reconciliation/apply',headers,payload:{...applyPayload,evaluation_at:'2026-09-27T11:00:00.000Z'}});
    expect(divergent.statusCode).toBe(409);expect(divergent.json()).toEqual({message:'idempotency_conflict'});
    await app.close();
  });
});
