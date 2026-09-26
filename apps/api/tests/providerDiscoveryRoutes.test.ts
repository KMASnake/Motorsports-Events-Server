import Fastify from 'fastify';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { registerAdminAuth,signAdminToken } from '../src/lib/adminAuth.js';
import type { ProviderDiscoveryService } from '../src/providers/discoveryService.js';
import { providerDiscoveryRoutes } from '../src/routes/providerDiscovery.js';

const secret='lot-5-3-route-auth-secret-at-least-32-characters';
const id='10000000-0000-4000-8000-000000000001';
const discoveryId='20000000-0000-4000-8000-000000000002';
const token=(role:'admin'|'viewer')=>signAdminToken({sub:'tester',role,exp:Math.floor(Date.now()/1000)+60},secret);

describe('Provider discovery administration routes',()=>{let app:ReturnType<typeof Fastify>;
  beforeEach(async()=>{app=Fastify({logger:false});registerAdminAuth(app,secret);const service={config:async()=>({discovery_enabled:false,discovery_interval_days:30}),setConfig:async()=>({discovery_enabled:true,discovery_interval_days:30}),testConnection:async()=>({ok:true,request_count:1}),discover:async()=>({status:'completed',request_count:1}),list:async()=>[],history:async()=>[],associate:async()=>({sync_state:'inactive'}),createAndAssociate:async()=>({link:{sync_state:'inactive'}}),adopt:async()=>({config:{strategy:'events-endpoint'}})} as unknown as ProviderDiscoveryService;await app.register(providerDiscoveryRoutes,{service});});
  afterEach(async()=>app.close());
  it('requires an administrator for discovery operations',async()=>{expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/discoveries`})).statusCode).toBe(401);expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/discoveries`,headers:{authorization:`Bearer ${token('viewer')}`}})).statusCode).toBe(403);expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/discoveries`,headers:{authorization:`Bearer ${token('admin')}`}})).statusCode).toBe(200);});
  it('keeps a manually associated source inactive',async()=>{const response=await app.inject({method:'POST',url:`/api/v1/admin/providers/${id}/discoveries/${discoveryId}/associate`,headers:{authorization:`Bearer ${token('admin')}`},payload:{championship_id:'formula-1'}});expect(response.statusCode).toBe(200);expect(response.json().sync_state).toBe('inactive');});
  it('rejects discovery intervals below seven days',async()=>{const response=await app.inject({method:'PUT',url:`/api/v1/admin/providers/${id}/discovery-config`,headers:{authorization:`Bearer ${token('admin')}`},payload:{enabled:true,interval_days:6}});expect(response.statusCode).toBe(400);});
});
