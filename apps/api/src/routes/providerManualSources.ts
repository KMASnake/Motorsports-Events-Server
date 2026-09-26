import type { FastifyInstance,FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { ManualChampionshipSourceService } from '../providers/manualSourceService.js';

const params=z.object({id:z.string().uuid()});
const body=z.object({championship_id:z.string().min(1).optional(),create_championship:z.object({name:z.string().trim().min(2).max(120),season:z.number().int().min(1950).max(2200)}).strict().optional(),source_config:z.record(z.string(),z.unknown())}).strict().refine(value=>Boolean(value.championship_id)!==Boolean(value.create_championship),{message:'Choisir un championnat existant ou une création explicite.'});
const context=(request:FastifyRequest)=>({principal:(request as FastifyRequest&{adminPrincipal:AdminPrincipal}).adminPrincipal,requestId:request.id});
const fail=(reply:{code(value:number):{send(value:unknown):unknown}},error:unknown)=>{const code=Number((error as {statusCode?:number}).statusCode??500);if(code<500)return reply.code(code).send({message:(error as Error).message});throw error;};

export async function providerManualSourceRoutes(app:FastifyInstance,options:{service:ManualChampionshipSourceService}){const service=options.service;
  app.get('/api/v1/admin/providers/:id/championship-form',async(request,reply)=>{const parsed=params.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Identifiant invalide.'});try{return await service.form(parsed.data.id)??reply.code(404).send({message:'Fournisseur introuvable.'});}catch(error){return fail(reply,error);}});
  app.post('/api/v1/admin/providers/:id/championship-sources/manual',async(request,reply)=>{const parsed=params.safeParse(request.params),input=body.safeParse(request.body);if(!parsed.success||!input.success)return reply.code(400).send({message:'Configuration manuelle invalide.'});try{const result=await service.create(parsed.data.id,{championshipId:input.data.championship_id,createChampionship:input.data.create_championship,sourceConfig:input.data.source_config as never},context(request));if(!result)return reply.code(404).send({message:'Fournisseur introuvable.'});markAtomicallyAudited(request);return reply.code(201).send(result);}catch(error){return fail(reply,error);}});
}
