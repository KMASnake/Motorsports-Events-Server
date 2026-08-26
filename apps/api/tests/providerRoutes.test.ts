import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAdminAuth, signAdminToken } from '../src/lib/adminAuth.js';
import type { ProviderConfigurationService } from '../src/providers/providerService.js';
import { providerRoutes } from '../src/routes/providers.js';
import type { ProviderSourcesAdminService } from '../src/providers/providerSourcesAdminService.js';

const authSecret = 'lot-5-2-technical-auth-secret-at-least-32-characters';
const providerId = '10000000-0000-4000-8000-000000000001';
const sentinel = 'SUPER_SECRET_SENTINEL_5_2';
const token = (role: 'admin' | 'viewer') => signAdminToken({ sub: 'test', role, exp: Math.floor(Date.now()/1000)+60 }, authSecret);

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
    const sources={championships:async()=>[{id:providerId,championship_id:'f1',source_config:{strategy:'series-events-v1'}}],updateChampionship:async()=>({id:providerId}),updateSourceConfig:async(_id:string,value:unknown)=>({config:value}),mappingState:async()=>({active:null,versions:[]}),createMapping:async()=>({id:providerId}),preflight:async()=>({status:'preflight_ok',PROVIDER_CALLS:0,provider_requests_emitted:0})} as unknown as ProviderSourcesAdminService;
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

  it('exposes source administration without provider execution',async()=>{
    const headers={authorization:`Bearer ${token('admin')}`};
    expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${providerId}/championships`,headers})).json()[0].championship_id).toBe('f1');
    const response=await app.inject({method:'POST',url:`/api/v1/admin/provider-championships/${providerId}/preflight`,headers,payload:{max_provider_requests:1}});
    expect(response.json()).toMatchObject({status:'preflight_ok',PROVIDER_CALLS:0,provider_requests_emitted:0});
  });

  it('strictly rejects malformed source and mapping payloads',async()=>{
    const headers={authorization:`Bearer ${token('admin')}`};
    expect((await app.inject({method:'PUT',url:`/api/v1/admin/provider-championships/${providerId}/source-config`,headers,payload:{config:{api_key:sentinel},extra:true}})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:`/api/v1/admin/provider-championships/${providerId}/normalization-mappings`,headers,payload:{version_label:'v2',rules_version:'v1',mapping_document:{}}})).statusCode).toBe(400);
  });
});
