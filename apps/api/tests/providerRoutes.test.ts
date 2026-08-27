import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAdminAuth, signAdminToken } from '../src/lib/adminAuth.js';
import type { ProviderConfigurationService } from '../src/providers/providerService.js';
import { providerRoutes, quotaBody } from '../src/routes/providers.js';
import type { ProviderSourcesAdminService } from '../src/providers/providerSourcesAdminService.js';

const authSecret = 'lot-5-2-technical-auth-secret-at-least-32-characters';
const providerId = '10000000-0000-4000-8000-000000000001';
const sentinel = 'SUPER_SECRET_SENTINEL_5_2';
const token = (role: 'admin' | 'viewer') => signAdminToken({ sub: 'test', role, exp: Math.floor(Date.now()/1000)+60 }, authSecret);
const deployedProviderId = '57f10000-0000-4000-8000-000000000001';
const quotaPayload = {
  short_window_seconds: null, short_limit: null, monthly_limit: 5000, limits_source: 'configured',
  reset_timezone: null, reset_at: null, minute_limit: 1, hourly_limit: 30, daily_limit: 200,
  minimum_interval_seconds: 60, safety_margin_percent: 5, current_reserve_mode: 'percent',
  current_reserve_value: 20, provider_timezone: 'UTC'
} as const;

describe('Provider administration routes', () => {
  let app: ReturnType<typeof Fastify>;
  beforeEach(async () => {
    app = Fastify({ logger: false });
    registerAdminAuth(app, authSecret);
    const service = {
      list: async () => [{ id: providerId, adapter_key: 'fake', config: {}, secrets: [{name:'api_key',configured:true}] }],
      get: async () => ({ id: providerId, adapter_key: 'fake', config: {}, secrets: [{name:'api_key',configured:true}] }),
      create: async () => ({ id: providerId, adapter_key: 'fake', config: {}, secrets: [] }),
      update: async () => ({ id: providerId, adapter_key: 'fake', config: {}, secrets: [] }),
      replaceSecret: async () => ({ name: 'api_key', secretConfigured: true }),
      removeSecret: async () => ({ name: 'api_key', secretConfigured: false }),
      quotaPolicy: async () => null,
      setQuotaPolicy: async () => ({ provider_instance_id: providerId, monthly_limit: 1000 })
    } as unknown as ProviderConfigurationService;
    const sources={championships:async()=>[{id:providerId,championship_id:'f1',source_config:{strategy:'series-events-v1'}}],updateChampionship:async()=>({id:providerId}),updateSourceConfig:async(_id:string,value:unknown)=>({config:value}),mappingState:async()=>({active:null,versions:[]}),createMapping:async()=>({id:providerId}),preflight:async()=>({status:'preflight_ok',configuration_ready:true,execution_ready:false,execution_blockers:['provider_disabled'],PROVIDER_CALLS:0,provider_requests_emitted:0})} as unknown as ProviderSourcesAdminService;
    await app.register(providerRoutes, { service, sources });
  });
  afterEach(async () => app.close());

  it('requires authentication and administrator role', async () => {
    expect((await app.inject({method:'GET',url:'/api/v1/admin/providers'})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/providers',headers:{authorization:`Bearer ${token('viewer')}`}})).statusCode).toBe(403);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/providers',headers:{authorization:`Bearer ${token('admin')}`}})).statusCode).toBe(200);
  });

  it('never returns a configured secret plaintext', async () => {
    const response = await app.inject({method:'PUT',url:`/api/v1/admin/providers/${providerId}/secrets/api_key`,
      headers:{authorization:`Bearer ${token('admin')}`},payload:{value:sentinel}});
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(sentinel);
    expect(response.json()).toEqual({name:'api_key',secretConfigured:true});
  });

  it('returns only secret metadata in provider JSON', async () => {
    const response = await app.inject({method:'GET',url:`/api/v1/admin/providers/${providerId}`,
      headers:{authorization:`Bearer ${token('admin')}`}});
    expect(response.body).not.toContain(sentinel);
    expect(response.json().secrets).toEqual([{name:'api_key',configured:true}]);
  });

  it('rejects invalid provider configuration before the service', async () => {
    const response = await app.inject({method:'POST',url:'/api/v1/admin/providers',
      headers:{authorization:`Bearer ${token('admin')}`},payload:{name:'Fake',adapter_key:'INVALID KEY'}});
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain('issues');
  });

  it('accepts the deployed quota payload in the isolated strict Zod schema', () => {
    const parsed = quotaBody.safeParse(quotaPayload);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it('parses the deployed JSON quota payload through Fastify without string coercion', async () => {
    const setQuotaPolicy = vi.fn().mockResolvedValue({provider_instance_id:deployedProviderId,monthly_limit:5000});
    const diagnosticApp = Fastify({logger:false});
    await diagnosticApp.register(providerRoutes,{service:{get:async()=>({id:deployedProviderId}),setQuotaPolicy} as unknown as ProviderConfigurationService});
    const response = await diagnosticApp.inject({method:'PUT',url:`/api/v1/admin/providers/${deployedProviderId}/quota-policy`,headers:{'content-type':'application/json'},payload:JSON.stringify(quotaPayload)});
    expect(response.statusCode).toBe(200);
    expect(setQuotaPolicy).toHaveBeenCalledOnce();
    const received = setQuotaPolicy.mock.calls[0][1] as Record<string,unknown>;
    expect(received).toMatchObject({minuteLimit:1,hourlyLimit:30,dailyLimit:200,monthlyLimit:5000,minimumIntervalSeconds:60,safetyMarginPercent:5,currentReserveValue:20,providerTimezone:'UTC'});
    for (const key of ['minuteLimit','hourlyLimit','dailyLimit','monthlyLimit','minimumIntervalSeconds','safetyMarginPercent','currentReserveValue']) expect(typeof received[key]).toBe('number');
    await diagnosticApp.close();
  });

  it('exposes source administration without provider execution',async()=>{
    const headers={authorization:`Bearer ${token('admin')}`};
    expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${providerId}/championships`,headers})).json()[0].championship_id).toBe('f1');
    const response=await app.inject({method:'POST',url:`/api/v1/admin/provider-championships/${providerId}/preflight`,headers,payload:{max_provider_requests:1}});
    expect(response.json()).toMatchObject({status:'preflight_ok',configuration_ready:true,execution_ready:false,PROVIDER_CALLS:0,provider_requests_emitted:0});
  });

  it('strictly rejects malformed source and mapping payloads',async()=>{
    const headers={authorization:`Bearer ${token('admin')}`};
    expect((await app.inject({method:'PUT',url:`/api/v1/admin/provider-championships/${providerId}/source-config`,headers,payload:{config:{api_key:sentinel},extra:true}})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:`/api/v1/admin/provider-championships/${providerId}/normalization-mappings`,headers,payload:{version_label:'v2',rules_version:'v1',mapping_document:{}}})).statusCode).toBe(400);
  });
});
