import Fastify from 'fastify';
import {describe,expect,it,vi} from 'vitest';
import {registerAdminAuth,signAdminToken} from '../src/lib/adminAuth.js';
import {createCsrfToken,validateHumanSession} from '../src/lib/adminSession.js';
import {meetingEventDecisionBody,meetingEventResolutionCandidateRoutes} from '../src/routes/meetingEventResolutionCandidates.js';

vi.mock('../src/lib/adminSession.js',async importOriginal=>({...await importOriginal<typeof import('../src/lib/adminSession.js')>(),validateHumanSession:vi.fn()}));
const secret='f5-meeting-event-admin-secret-at-least-32-characters',origin='http://admin.test';
const admin=signAdminToken({sub:'maintainer',role:'admin',exp:Math.floor(Date.now()/1000)+3600},secret);
const viewer=signAdminToken({sub:'viewer',role:'viewer',exp:Math.floor(Date.now()/1000)+3600},secret);
const candidateId='55000000-0000-4000-8000-000000000099';

async function secured(decide=vi.fn(async()=>({replayed:false,decision:{id:'decision'},publication:{outcome:'created'}}))){
  const app=Fastify();registerAdminAuth(app,secret,{cookie:{secure:false,sessionName:'mse_admin_session',csrfName:'mse_admin_csrf'},sessionSecret:secret,webOrigin:origin});
  await app.register(meetingEventResolutionCandidateRoutes,{service:{decide,list:vi.fn().mockResolvedValue([]),detail:vi.fn()} as any});return {app,decide};
}

describe('F5-5 Meeting/Event resolution admin contract',()=>{
  it('accepts only strict revisioned idempotent decisions',()=>{
    expect(meetingEventDecisionBody.safeParse({action:'link',expected_revision:2,idempotency_key:'decision-1',reason:'Exact source evidence',target_canonical_id:'55000000-0000-4000-8000-000000000040'}).success).toBe(true);
    expect(meetingEventDecisionBody.safeParse({action:'create',expected_revision:2,idempotency_key:'decision-2',reason:'No canonical match',unexpected:true}).success).toBe(false);
    expect(meetingEventDecisionBody.safeParse({action:'reject',expected_revision:0,idempotency_key:'decision-3',reason:'Ambiguous'}).success).toBe(false);
  });
  it('forwards an admin decision without any provider execution',async()=>{
    const decide=vi.fn(async()=>({replayed:false,decision:{id:'decision'},publication:{outcome:'updated'}}));
    const app=Fastify();
    app.addHook('preHandler',async request=>{(request as any).adminPrincipal={sub:'maintainer'};});
    await app.register(meetingEventResolutionCandidateRoutes,{service:{decide,list:vi.fn(),detail:vi.fn()} as any});
    const response=await app.inject({method:'POST',url:'/api/v1/admin/meeting-event-resolution-candidates/55000000-0000-4000-8000-000000000099/decisions',payload:{action:'create',expected_revision:1,idempotency_key:'create-1',reason:'Explicit review'}});
    expect(response.statusCode).toBe(200);
    expect(decide).toHaveBeenCalledWith('55000000-0000-4000-8000-000000000099',expect.objectContaining({action:'create',expectedRevision:1,idempotencyKey:'create-1'}),expect.objectContaining({actor:'maintainer'}));
    await app.close();
  });
  it('rejects malformed decision payloads before the service',async()=>{
    const decide=vi.fn();const app=Fastify();
    await app.register(meetingEventResolutionCandidateRoutes,{service:{decide,list:vi.fn(),detail:vi.fn()} as any});
    const response=await app.inject({method:'POST',url:'/api/v1/admin/meeting-event-resolution-candidates/55000000-0000-4000-8000-000000000099/decisions',payload:{action:'link',expected_revision:1,idempotency_key:'x',reason:'x',target_canonical_id:'not-a-uuid'}});
    expect(response.statusCode).toBe(400);expect(decide).not.toHaveBeenCalled();await app.close();
  });
  it('directly enforces authentication and the admin role on the new routes',async()=>{
    const {app}=await secured();
    expect((await app.inject({method:'GET',url:'/api/v1/admin/meeting-event-resolution-candidates'})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/meeting-event-resolution-candidates',headers:{authorization:`Bearer ${viewer}`}})).statusCode).toBe(403);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/meeting-event-resolution-candidates',headers:{authorization:`Bearer ${admin}`}})).statusCode).toBe(200);
    await app.close();
  });
  it('directly rejects missing or invalid human CSRF and accepts the bound token',async()=>{
    const session={id:'session-f5',username:'maintainer',idleExpiresAt:new Date(Date.now()+60000),absoluteExpiresAt:new Date(Date.now()+60000)};
    vi.mocked(validateHumanSession).mockResolvedValue(session);const csrf=createCsrfToken(session.id,secret),{app}=await secured();
    const payload={action:'create',expected_revision:1,idempotency_key:'csrf-create',reason:'Reviewed'};
    const cookie=`mse_admin_session=opaque; mse_admin_csrf=${csrf}`;
    expect((await app.inject({method:'POST',url:`/api/v1/admin/meeting-event-resolution-candidates/${candidateId}/decisions`,headers:{cookie,origin},payload})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:`/api/v1/admin/meeting-event-resolution-candidates/${candidateId}/decisions`,headers:{cookie,origin,'x-csrf-token':'invalid'},payload})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:`/api/v1/admin/meeting-event-resolution-candidates/${candidateId}/decisions`,headers:{cookie,origin,'x-csrf-token':csrf},payload})).statusCode).toBe(200);
    await app.close();vi.mocked(validateHumanSession).mockReset();
  });
  it('returns a stable conflict for stale expected revision',async()=>{
    const decide=vi.fn(async()=>{throw Object.assign(new Error('Meeting/Event candidate revision conflict.'),{statusCode:409});}),{app}=await secured(decide);
    const response=await app.inject({method:'POST',url:`/api/v1/admin/meeting-event-resolution-candidates/${candidateId}/decisions`,headers:{authorization:`Bearer ${admin}`},payload:{action:'create',expected_revision:1,idempotency_key:'stale',reason:'Reviewed'}});
    expect(response.statusCode).toBe(409);expect(response.json()).toEqual({message:'Meeting/Event candidate revision conflict.'});await app.close();
  });
});
