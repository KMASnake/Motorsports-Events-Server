import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAdminAuth, signAdminToken } from '../src/lib/adminAuth.js';
import type { ProviderConfigurationService } from '../src/providers/providerService.js';
import { providerRoutes } from '../src/routes/providers.js';

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
    await app.register(providerRoutes, { service });
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
});
