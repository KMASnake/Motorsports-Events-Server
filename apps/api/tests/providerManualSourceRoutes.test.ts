import Fastify from 'fastify';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { registerAdminAuth,signAdminToken } from '../src/lib/adminAuth.js';
import type { ManualChampionshipSourceService } from '../src/providers/manualSourceService.js';
import { providerManualSourceRoutes } from '../src/routes/providerManualSources.js';

const secret='lot-5-3-manual-route-secret-at-least-32-chars';
const id='10000000-0000-4000-8000-000000000001';
const token=(role:'admin'|'viewer')=>signAdminToken({sub:'tester',role,exp:Math.floor(Date.now()/1000)+60},secret);

describe('Manual provider championship source routes',()=>{let app:ReturnType<typeof Fastify>;
  beforeEach(async()=>{app=Fastify({logger:false});registerAdminAuth(app,secret);const service={form:async()=>({adapter_key:'no-discovery',schema_version:1,fields:[{key:'external_id',label:'ID',type:'text',required:true}]}),create:async()=>({status:'configured_not_synchronized',provider_championship:{sync_state:'inactive',is_primary:false}})} as unknown as ManualChampionshipSourceService;await app.register(providerManualSourceRoutes,{service});});
  afterEach(async()=>app.close());
  it('protects the form and manual mutation with admin authorization',async()=>{expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/championship-form`})).statusCode).toBe(401);expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/championship-form`,headers:{authorization:`Bearer ${token('viewer')}`}})).statusCode).toBe(403);expect((await app.inject({method:'GET',url:`/api/v1/admin/providers/${id}/championship-form`,headers:{authorization:`Bearer ${token('admin')}`}})).statusCode).toBe(200);});
  it('creates an inactive non-primary manual source',async()=>{const response=await app.inject({method:'POST',url:`/api/v1/admin/providers/${id}/championship-sources/manual`,headers:{authorization:`Bearer ${token('admin')}`},payload:{championship_id:'formula-1',source_config:{external_id:'future-series'}}});expect(response.statusCode).toBe(201);expect(response.json()).toMatchObject({status:'configured_not_synchronized',provider_championship:{sync_state:'inactive',is_primary:false}});});
  it('requires exactly one explicit championship choice',async()=>{const response=await app.inject({method:'POST',url:`/api/v1/admin/providers/${id}/championship-sources/manual`,headers:{authorization:`Bearer ${token('admin')}`},payload:{source_config:{external_id:'future-series'}}});expect(response.statusCode).toBe(400);});
});
