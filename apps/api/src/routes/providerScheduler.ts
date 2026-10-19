import type { FastifyInstance,FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { PersistentSchedulerService } from '../providers/schedulerService.js';
import type { DiscoveryContext } from '../providers/discoveryService.js';

const id=z.object({id:z.string().uuid()});
const context=(request:FastifyRequest)=>({principal:(request as FastifyRequest&{adminPrincipal:AdminPrincipal}).adminPrincipal,requestId:request.id});
const fail=(reply:any,error:unknown)=>{const code=Number((error as {statusCode?:number}).statusCode??500);if(code<500)return reply.code(code).send({message:(error as Error).message});throw error;};
const mutation=(method:(linkId:string,operationContext:DiscoveryContext)=>Promise<unknown>)=>async(request:FastifyRequest,reply:any)=>{const parsed=id.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Identifiant invalide.'});try{const result=await method(parsed.data.id,context(request));markAtomicallyAudited(request);return result;}catch(error){return fail(reply,error);}};

export async function providerSchedulerRoutes(app:FastifyInstance,options:{service:PersistentSchedulerService}){const service=options.service;
  app.get('/api/v1/admin/scheduler/config',()=>service.config());
  app.put('/api/v1/admin/scheduler/config',async(request,reply)=>{const parsed=z.object({global_worker_pool:z.number().int().min(1).max(64),lease_duration_seconds:z.number().int().min(30).max(3600),heartbeat_seconds:z.number().int().min(5).max(600),weight_current:z.number().int().positive(),weight_recent:z.number().int().positive(),weight_deep:z.number().int().positive(),sync_now_boost_minutes:z.number().int().min(1).max(1440)}).strict().refine(value=>value.heartbeat_seconds<value.lease_duration_seconds).safeParse(request.body);if(!parsed.success)return reply.code(400).send({message:'Configuration scheduler invalide.'});const value=await service.setConfig({globalWorkerPool:parsed.data.global_worker_pool,leaseDurationSeconds:parsed.data.lease_duration_seconds,heartbeatSeconds:parsed.data.heartbeat_seconds,weightCurrent:parsed.data.weight_current,weightRecent:parsed.data.weight_recent,weightDeep:parsed.data.weight_deep,syncNowBoostMinutes:parsed.data.sync_now_boost_minutes},context(request));markAtomicallyAudited(request);return value;});
  app.get('/api/v1/admin/provider-championships/:id/sync-streams',async(request,reply)=>{const parsed=id.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Identifiant invalide.'});return service.streams(parsed.data.id);});
  app.get('/api/v1/admin/provider-championships/:id/sync-runs',async(request,reply)=>{const parsed=id.safeParse(request.params);if(!parsed.success)return reply.code(400).send({message:'Identifiant invalide.'});return service.runs(parsed.data.id);});
  app.post('/api/v1/admin/provider-championships/:id/sync/activate',mutation((value,ctx)=>service.activate(value,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/sync/deactivate',mutation((value,ctx)=>service.deactivate(value,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/sync/pause',mutation((value,ctx)=>service.pause(value,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/sync/resume',mutation((value,ctx)=>service.resume(value,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/sync-now',mutation((value,ctx)=>service.syncNow(value,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/championship/disable',mutation((value,ctx)=>service.setChampionshipActive(value,false,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/championship/reactivate',mutation((value,ctx)=>service.setChampionshipActive(value,true,ctx)));
  app.post('/api/v1/admin/provider-championships/:id/sync/reset',async(request,reply)=>{const parsed=id.safeParse(request.params),body=z.object({phase:z.enum(['current','historical'])}).strict().safeParse(request.body);if(!parsed.success||!body.success)return reply.code(400).send({message:'Reset ciblé invalide.'});try{const result=await service.reset(parsed.data.id,body.data.phase,context(request));markAtomicallyAudited(request);return result;}catch(error){return fail(reply,error);}});
}
