import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {AdminPrincipal} from '../lib/adminAuth.js';
import {markAtomicallyAudited} from '../lib/adminAudit.js';
import {MeetingEventResolutionService} from '../normalization/meetingEventResolutionService.js';

const params=z.object({id:z.string().uuid()}).strict();
const query=z.object({state:z.enum(['PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).strict();
export const meetingEventDecisionBody=z.discriminatedUnion('action',[
  z.object({action:z.literal('link'),expected_revision:z.number().int().positive(),idempotency_key:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(2000),target_canonical_id:z.string().uuid()}).strict(),
  z.object({action:z.literal('create'),expected_revision:z.number().int().positive(),idempotency_key:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(2000)}).strict(),
  z.object({action:z.literal('reject'),expected_revision:z.number().int().positive(),idempotency_key:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(2000)}).strict()
]);

export async function meetingEventResolutionCandidateRoutes(app:FastifyInstance,options:{service?:MeetingEventResolutionService}={}){
  const service=options.service??new MeetingEventResolutionService();
  app.get('/api/v1/admin/meeting-event-resolution-candidates',async(request,reply)=>{const parsed=query.safeParse(request.query);if(!parsed.success)return reply.code(400).send({message:'Invalid Meeting/Event candidate filters.'});return service.list(parsed.data);});
  app.get('/api/v1/admin/meeting-event-resolution-candidates/:id',async(request,reply)=>{const parsed=params.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Invalid Meeting/Event candidate identifier.'});const result=await service.detail(parsed.data.id);return result??reply.code(404).send({message:'Meeting/Event candidate not found.'});});
  app.post('/api/v1/admin/meeting-event-resolution-candidates/:id/decisions',async(request,reply)=>{
    const parsedParams=params.safeParse(request.params),body=meetingEventDecisionBody.safeParse(request.body);
    if(!parsedParams.success||!body.success)return reply.code(400).send({message:'Invalid Meeting/Event decision.'});
    const principal=(request as FastifyRequest&{adminPrincipal:AdminPrincipal}).adminPrincipal;
    try{const result=await service.decide(parsedParams.data.id,{expectedRevision:body.data.expected_revision,idempotencyKey:body.data.idempotency_key,action:body.data.action,reason:body.data.reason,targetCanonicalId:'target_canonical_id' in body.data?body.data.target_canonical_id:null},{actor:principal.sub,requestId:request.id,occurredAt:new Date()});markAtomicallyAudited(request);return result;}
    catch(error){const code=Number((error as {statusCode?:number}).statusCode??500);if(code<500)return reply.code(code).send({message:(error as Error).message});throw error;}
  });
}
