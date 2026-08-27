import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import type { JsonObject } from '../providers/contracts.js';
import { ProviderMasterKeyError } from '../providers/providerSecrets.js';
import { ProviderConfigurationService } from '../providers/providerService.js';
import type { QuotaCadenceService } from '../providers/quotaCadenceService.js';
import type { ProviderSourcesAdminService } from '../providers/providerSourcesAdminService.js';

const uuid = z.string().uuid();
const validTimezone=(value:string)=>{try{new Intl.DateTimeFormat('fr-FR',{timeZone:value}).format();return true;}catch{return false;}};
const providerBody = z.object({
  name: z.string().trim().min(1).max(160),
  adapter_key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  config: z.record(z.string(), z.json()).default({}),
  enabled: z.boolean().default(false),
  discovery_enabled: z.boolean().default(false),
  max_concurrency: z.number().int().min(1).max(100).default(1),
  current_year_reserve_percent: z.number().min(0).max(50).default(20),
  missing_cycles_threshold: z.number().int().min(1).max(1000).default(3),
  log_retention_days: z.number().int().min(1).max(3650).default(30)
}).strict();
const providerPatch = z.object({
  name: providerBody.shape.name.optional(),
  adapter_key: providerBody.shape.adapter_key.optional(),
  config: z.record(z.string(), z.json()).optional(),
  enabled: z.boolean().optional(),
  discovery_enabled: z.boolean().optional(),
  max_concurrency: z.number().int().min(1).max(100).optional(),
  current_year_reserve_percent: z.number().min(0).max(50).optional(),
  missing_cycles_threshold: z.number().int().min(1).max(1000).optional(),
  log_retention_days: z.number().int().min(1).max(3650).optional()
}).strict();
const secretBody = z.object({ value: z.string().min(1).max(8192) }).strict();
const secretParams = z.object({ id: uuid, name: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/) });
export const quotaBody = z.object({
  short_window_seconds: z.number().int().positive().nullable().default(null),
  short_limit: z.number().int().positive().nullable().default(null),
  monthly_limit: z.number().int().positive().nullable().default(null),
  limits_source: z.enum(['configured','provider_headers','hybrid']).default('configured'),
  reset_timezone: z.string().trim().min(1).max(80).nullable().default(null),
  reset_at: z.string().datetime({ offset: true }).nullable().default(null)
  ,minute_limit:z.number().int().positive().nullable().default(null)
  ,hourly_limit:z.number().int().positive().nullable().default(null)
  ,daily_limit:z.number().int().positive().nullable().default(null)
  ,minimum_interval_seconds:z.number().int().min(0).max(86400).default(1)
  ,safety_margin_percent:z.number().min(0).max(20).default(5)
  ,current_reserve_mode:z.enum(['percent','absolute']).default('percent')
  ,current_reserve_value:z.number().int().min(0).default(20)
  ,provider_timezone:z.string().trim().min(1).max(80).default('UTC')
}).strict().refine((value) => (value.short_window_seconds === null) === (value.short_limit === null), {
  message: 'La fenêtre et la limite court terme doivent être fournies ensemble.'
}).refine(value=>value.current_reserve_mode!=='percent'||value.current_reserve_value<=50,{message:'La réserve en pourcentage doit être comprise entre 0 et 50.'
}).refine(value=>validTimezone(value.provider_timezone),{message:'Fuseau fournisseur invalide.'});

const mutationContext = (request: FastifyRequest) => ({
  principal: (request as FastifyRequest & { adminPrincipal: AdminPrincipal }).adminPrincipal,
  requestId: request.id
});
const input = (value: z.infer<typeof providerBody>) => ({
  name: value.name, adapterKey: value.adapter_key, config: value.config as JsonObject, enabled: value.enabled, discoveryEnabled:value.discovery_enabled,
  maxConcurrency: value.max_concurrency, currentYearReservePercent: value.current_year_reserve_percent,
  missingCyclesThreshold: value.missing_cycles_threshold, logRetentionDays: value.log_retention_days
});
const fail = (reply: { code(status: number): { send(value: unknown): unknown } }, error: unknown) => {
  if (error instanceof ProviderMasterKeyError) return reply.code(503).send({ message: error.message });
  const status = Number((error as { statusCode?: number }).statusCode ?? 500);
  if (status < 500) return reply.code(status).send({ message: (error as Error).message });
  throw error;
};

const championshipPatch=z.object({external_championship_id:z.string().trim().min(1).max(160),is_primary:z.boolean()}).strict();
const sourceBody=z.object({config:z.record(z.string(),z.json())}).strict();
const mappingBody=z.object({version_label:z.string().trim().min(1).max(128),rules_version:z.string().trim().min(1).max(128),mapping_document:z.object({championshipIds:z.record(z.string(),z.string()),circuitIds:z.record(z.string(),z.string()),sessionTypes:z.record(z.string(),z.enum(['practice','qualifying','sprint_qualifying','sprint','race','other'])),statuses:z.record(z.string(),z.enum(['scheduled','confirmed','postponed','cancelled','completed']))}).strict()}).strict();
const preflightBody=z.object({max_provider_requests:z.number().int().positive().max(100).default(1)}).strict();

export async function providerRoutes(app: FastifyInstance, options: { service: ProviderConfigurationService; quota?:QuotaCadenceService;sources?:ProviderSourcesAdminService }): Promise<void> {
  const service = options.service;
  app.get('/api/v1/admin/providers', async () => service.list());
  app.get('/api/v1/admin/providers/:id', async (request, reply) => {
    const parsed = uuid.safeParse((request.params as {id:string}).id);
    if (!parsed.success) return reply.code(400).send({ message: 'Identifiant fournisseur invalide.' });
    return await service.get(parsed.data) ?? reply.code(404).send({ message: 'Fournisseur introuvable.' });
  });
  app.post('/api/v1/admin/providers', async (request, reply) => {
    const parsed = providerBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Configuration fournisseur invalide.' });
    try { const result = await service.create(input(parsed.data), mutationContext(request)); markAtomicallyAudited(request); return reply.code(201).send(result); }
    catch (error) { if ((error as {code?:string}).code === '23505') return reply.code(409).send({message:'Ce nom de fournisseur existe déjà.'}); return fail(reply,error); }
  });
  app.patch('/api/v1/admin/providers/:id', async (request, reply) => {
    const id = uuid.safeParse((request.params as {id:string}).id); const body = providerPatch.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ message: 'Configuration fournisseur invalide.' });
    const current = await service.get(id.data);
    if (!current) return reply.code(404).send({message:'Fournisseur introuvable.'});
    const complete = providerBody.parse({
      name:current.name,adapter_key:current.adapter_key,config:current.config,enabled:current.enabled,discovery_enabled:current.discovery_enabled,
      max_concurrency:current.max_concurrency,current_year_reserve_percent:current.current_year_reserve_percent,
      missing_cycles_threshold:current.missing_cycles_threshold,log_retention_days:current.log_retention_days,...body.data
    });
    try { const result = await service.update(id.data,input(complete),mutationContext(request)); if (!result) return reply.code(404).send({message:'Fournisseur introuvable.'}); markAtomicallyAudited(request); return result; }
    catch (error) { if ((error as {code?:string}).code === '23505') return reply.code(409).send({message:'Ce nom de fournisseur existe déjà.'}); return fail(reply,error); }
  });
  app.put('/api/v1/admin/providers/:id/secrets/:name', async (request, reply) => {
    const params = secretParams.safeParse(request.params); const body = secretBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: 'Secret fournisseur invalide.' });
    try { const result = await service.replaceSecret(params.data.id,params.data.name,body.data.value,mutationContext(request)); if (!result) return reply.code(404).send({message:'Fournisseur introuvable.'}); markAtomicallyAudited(request); return result; }
    catch (error) { return fail(reply,error); }
  });
  app.delete('/api/v1/admin/providers/:id/secrets/:name', async (request, reply) => {
    const params = secretParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Secret fournisseur invalide.' });
    const result = await service.removeSecret(params.data.id,params.data.name,mutationContext(request));
    if (!result) return reply.code(404).send({message:'Fournisseur introuvable.'}); markAtomicallyAudited(request); return result;
  });
  app.get('/api/v1/admin/providers/:id/quota-policy', async (request, reply) => {
    const id = uuid.safeParse((request.params as {id:string}).id); if (!id.success) return reply.code(400).send({message:'Identifiant fournisseur invalide.'});
    if (!await service.get(id.data)) return reply.code(404).send({message:'Fournisseur introuvable.'});
    return await service.quotaPolicy(id.data) ?? { provider_instance_id:id.data, short_window_seconds:null, short_limit:null, minute_limit:null,hourly_limit:null,daily_limit:null,monthly_limit:null, limits_source:'configured', reset_timezone:null, reset_at:null,minimum_interval_seconds:1,safety_margin_percent:5,current_reserve_mode:'percent',current_reserve_value:20,provider_timezone:'UTC' };
  });
  app.put('/api/v1/admin/providers/:id/quota-policy', async (request, reply) => {
    const id = uuid.safeParse((request.params as {id:string}).id); const body = quotaBody.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({message:'Politique de quota invalide.'});
    const value = body.data; const result = await service.setQuotaPolicy(id.data,{shortWindowSeconds:value.short_window_seconds,shortLimit:value.short_limit,monthlyLimit:value.monthly_limit,limitsSource:value.limits_source,resetTimezone:value.reset_timezone,resetAt:value.reset_at,minuteLimit:value.minute_limit,hourlyLimit:value.hourly_limit,dailyLimit:value.daily_limit,minimumIntervalSeconds:value.minimum_interval_seconds,safetyMarginPercent:value.safety_margin_percent,currentReserveMode:value.current_reserve_mode,currentReserveValue:value.current_reserve_value,providerTimezone:value.provider_timezone},mutationContext(request));
    if (!result) return reply.code(404).send({message:'Fournisseur introuvable.'}); markAtomicallyAudited(request); return result;
  });
  app.get('/api/v1/admin/providers/:id/quota-diagnostics',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id);if(!id.success)return reply.code(400).send({message:'Identifiant fournisseur invalide.'});if(!options.quota)return reply.code(503).send({message:'Diagnostic quota indisponible.'});if(!await service.get(id.data))return reply.code(404).send({message:'Fournisseur introuvable.'});return options.quota.diagnostics(id.data);});
  app.get('/api/v1/admin/providers/:id/championships',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id);if(!id.success)return reply.code(400).send({message:'Identifiant fournisseur invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});return await options.sources.championships(id.data)??reply.code(404).send({message:'Fournisseur introuvable.'});});
  app.patch('/api/v1/admin/provider-championships/:id',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id),body=championshipPatch.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({message:'Configuration championnat invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});const result=await options.sources.updateChampionship(id.data,{externalChampionshipId:body.data.external_championship_id,isPrimary:body.data.is_primary},mutationContext(request));if(!result)return reply.code(404).send({message:'Association introuvable.'});markAtomicallyAudited(request);return result;});
  app.put('/api/v1/admin/provider-championships/:id/source-config',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id),body=sourceBody.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({message:'Configuration source invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});try{const result=await options.sources.updateSourceConfig(id.data,body.data.config as JsonObject,mutationContext(request));if(!result)return reply.code(404).send({message:'Association introuvable.'});markAtomicallyAudited(request);return result;}catch(error){return fail(reply,error);}});
  app.get('/api/v1/admin/provider-championships/:id/normalization-mappings',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id);if(!id.success)return reply.code(400).send({message:'Identifiant association invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});return options.sources.mappingState(id.data);});
  app.post('/api/v1/admin/provider-championships/:id/normalization-mappings',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id),body=mappingBody.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({message:'Mapping invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});try{const result=await options.sources.createMapping(id.data,{versionLabel:body.data.version_label,rulesVersion:body.data.rules_version,mappingDocument:body.data.mapping_document},mutationContext(request));markAtomicallyAudited(request);return reply.code(201).send(result);}catch(error){return fail(reply,error);}});
  app.post('/api/v1/admin/provider-championships/:id/preflight',async(request,reply)=>{const id=uuid.safeParse((request.params as {id:string}).id),body=preflightBody.safeParse(request.body??{});if(!id.success||!body.success)return reply.code(400).send({message:'Preflight invalide.'});if(!options.sources)return reply.code(503).send({message:'Administration des sources indisponible.'});const result=await options.sources.preflight(id.data,body.data.max_provider_requests);return result??reply.code(404).send({message:'Association introuvable.'});});
}
