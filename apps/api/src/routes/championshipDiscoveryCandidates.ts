import type { FastifyInstance,FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { ChampionshipDiscoveryResolutionService } from '../providers/championshipDiscoveryResolutionService.js';

const uuid=z.string().uuid(),nullableYear=z.number().int().min(1800).max(2400).nullable().optional();
const params=z.object({id:uuid}).strict();
const query=z.object({state:z.enum(['PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
const common={expected_revision:z.number().int().positive(),idempotency_key:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(2000).nullable().optional()};
export const discoveryDecisionBody=z.discriminatedUnion('decision',[
  z.object({...common,decision:z.literal('link'),championship_id:z.string().trim().min(1).max(256),championship_season_id:uuid.nullable().optional()}).strict(),
  z.object({...common,decision:z.literal('create'),championship_id:z.string().trim().min(1).max(256).optional(),championship:z.object({name:z.string().trim().min(2).max(120),slug:z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),discipline_key:z.string().trim().min(1).max(64).nullable().optional(),season:z.number().int().min(1800).max(2400).optional()}).strict().optional(),season:z.object({key:z.string().trim().min(1).max(120),label:z.string().trim().min(1).max(200),start_year:nullableYear,end_year:nullableYear,starts_on:z.iso.date().nullable().optional(),ends_on:z.iso.date().nullable().optional()}).strict().optional()}).strict()
    .refine(value=>Boolean(value.championship_id)!==Boolean(value.championship),{message:'Provide exactly one existing or new Championship.'}),
  z.object({...common,decision:z.literal('reject'),reason:z.string().trim().min(1).max(2000)}).strict()
]);

export async function championshipDiscoveryCandidateRoutes(app:FastifyInstance,options:{service?:ChampionshipDiscoveryResolutionService}={}){
  const service=options.service??new ChampionshipDiscoveryResolutionService();
  app.get('/api/v1/admin/championship-discovery-candidates',async(request,reply)=>{const parsed=query.safeParse(request.query);if(!parsed.success)return reply.code(400).send({message:'Invalid discovery candidate filters.'});return service.list(parsed.data);});
  app.get('/api/v1/admin/championship-discovery-candidates/:id',async(request,reply)=>{const parsed=params.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Invalid discovery candidate identifier.'});const result=await service.detail(parsed.data.id);return result??reply.code(404).send({message:'Discovery candidate not found.'});});
  app.post('/api/v1/admin/championship-discovery-candidates/:id/decisions',async(request,reply)=>{
    const parsedParams=params.safeParse(request.params),body=discoveryDecisionBody.safeParse(request.body);
    if(!parsedParams.success||!body.success)return reply.code(400).send({message:'Invalid discovery decision.',...(body.success?{}:{issues:body.error.issues})});
    const principal=(request as FastifyRequest&{adminPrincipal:AdminPrincipal}).adminPrincipal;
    try{
      const value=body.data;
      const result=await service.decide(parsedParams.data.id,{
        expectedRevision:value.expected_revision,idempotencyKey:value.idempotency_key,reason:value.reason,decision:value.decision,
        ...('championship_id' in value?{championshipId:value.championship_id}:{}),
        ...('championship_season_id' in value?{championshipSeasonId:value.championship_season_id}:{}),
        ...('championship' in value&&value.championship?{championship:{name:value.championship.name,slug:value.championship.slug,disciplineKey:value.championship.discipline_key,season:value.championship.season}}:{}),
        ...('season' in value&&value.season?{season:{key:value.season.key,label:value.season.label,startYear:value.season.start_year,endYear:value.season.end_year,startsOn:value.season.starts_on,endsOn:value.season.ends_on}}:{})
      },{actor:principal.sub,requestId:request.id});
      markAtomicallyAudited(request);return result;
    }catch(error){const code=Number((error as {statusCode?:number}).statusCode??500);if(code<500)return reply.code(code).send({message:(error as Error).message});throw error;}
  });
}
