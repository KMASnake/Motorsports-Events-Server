import Fastify from 'fastify';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { registerAdminAuth,signAdminToken } from '../src/lib/adminAuth.js';
import type { ChampionshipDiscoveryResolutionService } from '../src/providers/championshipDiscoveryResolutionService.js';
import { assertCandidateTransition,ChampionshipDiscoveryResolutionService,normalizedDiscoveryName,normalizedSeasonLabel } from '../src/providers/championshipDiscoveryResolutionService.js';
import { championshipDiscoveryCandidateRoutes,discoveryDecisionBody } from '../src/routes/championshipDiscoveryCandidates.js';

const secret='f5-discovery-admin-auth-secret-at-least-32-characters';
const id='35000000-0000-4000-8000-000000000001';
const token=signAdminToken({sub:'f5-admin',role:'admin',exp:Math.floor(Date.now()/1000)+60},secret);

describe('F5-4 discovery candidate admin API',()=>{let app:ReturnType<typeof Fastify>;const decide=vi.fn();
  beforeEach(async()=>{app=Fastify({logger:false});registerAdminAuth(app,secret);decide.mockResolvedValue({replayed:false});const service={list:vi.fn().mockResolvedValue([]),detail:vi.fn().mockResolvedValue({candidate:{id}}),decide} as unknown as ChampionshipDiscoveryResolutionService;await app.register(championshipDiscoveryCandidateRoutes,{service});});
  afterEach(async()=>app.close());
  it('requires admin authentication',async()=>{expect((await app.inject({method:'GET',url:'/api/v1/admin/championship-discovery-candidates'})).statusCode).toBe(401);});
  it('passes expected revision and idempotency key to a strict decision boundary',async()=>{const response=await app.inject({method:'POST',url:`/api/v1/admin/championship-discovery-candidates/${id}/decisions`,headers:{authorization:`Bearer ${token}`},payload:{decision:'link',expected_revision:3,idempotency_key:'decision-3',championship_id:'f1'}});expect(response.statusCode).toBe(200);expect(decide).toHaveBeenCalledWith(id,expect.objectContaining({decision:'link',expectedRevision:3,idempotencyKey:'decision-3',championshipId:'f1'}),expect.objectContaining({actor:'f5-admin'}));});
  it('rejects unknown fields and incomplete create decisions',async()=>{expect(discoveryDecisionBody.safeParse({decision:'reject',expected_revision:1,idempotency_key:'x',reason:'duplicate',enabled:true}).success).toBe(false);expect(discoveryDecisionBody.safeParse({decision:'create',expected_revision:1,idempotency_key:'x'}).success).toBe(false);});
});

describe('F5-4 deterministic normalization',()=>{
  it.each([['Formula 1','formula 1'],['Formúla-1','formula 1'],['  Season  2026 ','season 2026']])('normalizes labels without making them identities',(input,expected)=>expect(normalizedDiscoveryName(input)).toBe(expected));
  it('keeps nearby series distinct',()=>{expect(normalizedDiscoveryName('Formula 1')).not.toBe(normalizedDiscoveryName('Formula 2'));expect(normalizedDiscoveryName('MotoGP')).not.toBe(normalizedDiscoveryName('Moto2'));expect(normalizedDiscoveryName('WRC')).not.toBe(normalizedDiscoveryName('WRC2'));});
  it.each(['2026/27','2026-2027','Season 2026/27'])('normalizes cross-year Season labels without making the year an identity',(value)=>expect(normalizedSeasonLabel(value)).toBe('2026-2027'));
  it('keeps WorldSBK and WorldSSP distinct',()=>expect(normalizedDiscoveryName('WorldSBK')).not.toBe(normalizedDiscoveryName('WorldSSP')));
});

describe('F5-4 state machine and payload boundary',()=>{
  it.each([
    ['PENDING','REVIEW_REQUIRED'],['PENDING','RESOLVED_LINKED'],['PENDING','REJECTED'],
    ['REVIEW_REQUIRED','RESOLVED_LINKED'],['REVIEW_REQUIRED','RESOLVED_CREATED'],['REVIEW_REQUIRED','REJECTED']
  ] as const)('allows %s -> %s',(from,to)=>expect(()=>assertCandidateTransition(from,to)).not.toThrow());
  it.each([
    ['PENDING','RESOLVED_CREATED'],['RESOLVED_LINKED','REVIEW_REQUIRED'],['RESOLVED_LINKED','REJECTED'],
    ['RESOLVED_CREATED','REVIEW_REQUIRED'],['REJECTED','REVIEW_REQUIRED']
  ] as const)('rejects %s -> %s',(from,to)=>expect(()=>assertCandidateTransition(from,to)).toThrow(/Invalid discovery candidate transition/));

  const service=new ChampionshipDiscoveryResolutionService();
  const input=(payload:Record<string,never>|Record<string,unknown>)=>({providerInstanceId:id,discoveryRunId:id,provenance:'test_fixture' as const,externalChampionshipId:'series',championshipName:'Series',payload:payload as never,observedAt:new Date()});
  it.each([
    {events:[]},{meeting:{sessions:[]}},{results:[]},{standings:[]},{championship:{name:'Series',unknown:'value'}}
  ])('rejects acquisition or unknown payload structure before persistence',async payload=>await expect(service.ingestObservation(input(payload))).rejects.toMatchObject({statusCode:400}));
  it('rejects recursive secret keys before persistence',async()=>await expect(service.ingestObservation(input({championship:{name:'Series',metadata:{token:'forbidden'}}}))).rejects.toMatchObject({statusCode:400}));
});
