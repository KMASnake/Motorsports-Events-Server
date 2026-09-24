import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { uuid } from '../lib/routeParams.js';
import {
  CircuitNotFoundError, VenueKindNotFoundError, VenueLayoutNotFoundError, VenueLayoutScopeError,
  VenueNotFoundError, VenueService, type VenueInput, type VenueLayoutInput
} from '../venues/venueService.js';

const machineKey=z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);
const nullableText=(max:number)=>z.union([z.string().trim().min(1).max(max),z.null()]);
const timezone=nullableText(128).refine(value=>value===null||validTimezone(value),'Timezone IANA invalide.');
const coordinate=z.union([z.number().finite(),z.null()]);
const venueFields=z.object({
  key:machineKey,name:z.string().trim().min(1).max(200),kind_key:machineKey.max(64),
  city:nullableText(160),region:nullableText(160),country_code:z.union([z.string().regex(/^[A-Z]{2}$/),z.null()]),
  timezone,latitude:coordinate,longitude:coordinate
}).strict();
export const venueBody=z.object({
  key:machineKey,name:z.string().trim().min(1).max(200),kind_key:machineKey.max(64),
  city:nullableText(160).default(null),region:nullableText(160).default(null),country_code:z.union([z.string().regex(/^[A-Z]{2}$/),z.null()]).default(null),
  timezone:timezone.default(null),latitude:coordinate.default(null),longitude:coordinate.default(null)
}).strict().superRefine((value,context)=>{
  if ((value.latitude===null)!==(value.longitude===null)) context.addIssue({code:'custom',path:['latitude'],message:'Latitude et longitude doivent être fournies ensemble.'});
  if (value.latitude!==null&&(value.latitude < -90||value.latitude > 90)) context.addIssue({code:'custom',path:['latitude'],message:'Latitude hors limites.'});
  if (value.longitude!==null&&(value.longitude < -180||value.longitude > 180)) context.addIssue({code:'custom',path:['longitude'],message:'Longitude hors limites.'});
});
const venuePatch=venueFields.omit({key:true}).partial().strict();
const layoutBody=z.object({key:machineKey,name:z.string().trim().min(1).max(200)}).strict();
const layoutPatch=layoutBody.omit({key:true}).partial().strict();
const mappingBody=z.object({venue_id:uuid,venue_layout_id:z.union([uuid,z.null()]).default(null)}).strict();
const circuitId=z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/);

function validTimezone(value:string){try{new Intl.DateTimeFormat('en-US',{timeZone:value});return true;}catch{return false;}}
function errorReply(reply:{code(status:number):{send(value:unknown):unknown}},error:unknown){
  if(error instanceof VenueNotFoundError||error instanceof VenueLayoutNotFoundError||error instanceof CircuitNotFoundError) return reply.code(404).send({message:error.message});
  if(error instanceof VenueKindNotFoundError||error instanceof VenueLayoutScopeError) return reply.code(400).send({message:error.message});
  const code=(error as {code?:string}).code;
  if(code==='23505') return reply.code(409).send({message:'Cette clé canonique existe déjà.'});
  if(code==='23503'||code==='23514') return reply.code(400).send({message:'Référence ou valeur de lieu invalide.'});
  throw error;
}
export interface VenueRouteOptions {service?:VenueService}
export async function venueRoutes(app:FastifyInstance,options:VenueRouteOptions={}){
  const service=options.service??new VenueService();
  app.get('/api/v1/admin/venue-kinds',()=>service.listKinds());
  app.get('/api/v1/admin/venues',()=>service.listVenues());
  app.post('/api/v1/admin/venues',async(request,reply)=>{const body=venueBody.safeParse(request.body);if(!body.success)return reply.code(400).send({message:'Lieu invalide.',issues:body.error.issues});try{const result=await service.createVenue(body.data,request);markAtomicallyAudited(request);return reply.code(201).send(result);}catch(error){return errorReply(reply,error);}});
  app.get('/api/v1/admin/venues/:id',async(request,reply)=>{const params=z.object({id:uuid}).strict().safeParse(request.params);if(!params.success)return reply.code(400).send({message:'Identifiant de lieu invalide.'});return await service.getVenue(params.data.id)??reply.code(404).send({message:'Lieu introuvable.'});});
  app.patch('/api/v1/admin/venues/:id',async(request,reply)=>{const params=z.object({id:uuid}).strict().safeParse(request.params);const body=venuePatch.safeParse(request.body);if(!params.success||!body.success||Object.keys(body.data).length===0)return reply.code(400).send({message:'Lieu invalide.'});try{const result=await service.updateVenue(params.data.id,body.data,value=>venueBody.parse(value) as VenueInput,request);if(!result)return reply.code(404).send({message:'Lieu introuvable.'});markAtomicallyAudited(request);return result;}catch(error){if(error instanceof z.ZodError)return reply.code(400).send({message:'Lieu invalide.',issues:error.issues});return errorReply(reply,error);}});
  app.get('/api/v1/admin/venues/:venueId/layouts',async(request,reply)=>{const params=z.object({venueId:uuid}).strict().safeParse(request.params);if(!params.success)return reply.code(400).send({message:'Identifiant de lieu invalide.'});try{return await service.listLayouts(params.data.venueId);}catch(error){return errorReply(reply,error);}});
  app.post('/api/v1/admin/venues/:venueId/layouts',async(request,reply)=>{const params=z.object({venueId:uuid}).strict().safeParse(request.params);const body=layoutBody.safeParse(request.body);if(!params.success||!body.success)return reply.code(400).send({message:'Configuration de lieu invalide.'});try{const result=await service.createLayout(params.data.venueId,body.data,request);markAtomicallyAudited(request);return reply.code(201).send(result);}catch(error){return errorReply(reply,error);}});
  app.get('/api/v1/admin/venue-layouts/:id',async(request,reply)=>{const params=z.object({id:uuid}).strict().safeParse(request.params);if(!params.success)return reply.code(400).send({message:'Identifiant de configuration invalide.'});return await service.getLayout(params.data.id)??reply.code(404).send({message:'Configuration de lieu introuvable.'});});
  app.patch('/api/v1/admin/venue-layouts/:id',async(request,reply)=>{const params=z.object({id:uuid}).strict().safeParse(request.params);const body=layoutPatch.safeParse(request.body);if(!params.success||!body.success||Object.keys(body.data).length===0)return reply.code(400).send({message:'Configuration de lieu invalide.'});try{const result=await service.updateLayout(params.data.id,body.data,value=>layoutBody.parse(value) as VenueLayoutInput,request);if(!result)return reply.code(404).send({message:'Configuration de lieu introuvable.'});markAtomicallyAudited(request);return result;}catch(error){if(error instanceof z.ZodError)return reply.code(400).send({message:'Configuration de lieu invalide.',issues:error.issues});return errorReply(reply,error);}});
  app.get('/api/v1/admin/circuit-venue-links',()=>service.listCircuitLinks());
  app.put('/api/v1/admin/circuits/:circuitId/venue-link',async(request,reply)=>{const params=z.object({circuitId}).strict().safeParse(request.params);const body=mappingBody.safeParse(request.body);if(!params.success||!body.success)return reply.code(400).send({message:'Mapping Circuit/Lieu invalide.'});try{const result=await service.upsertCircuitLink(params.data.circuitId,body.data,request);markAtomicallyAudited(request);return result;}catch(error){return errorReply(reply,error);}});
}
