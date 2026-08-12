import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import type { JsonObject } from '../providers/contracts.js';
import { ProviderMasterKeyError } from '../providers/providerSecrets.js';
import { ProviderConfigurationService } from '../providers/providerService.js';

const uuid = z.string().uuid();
const providerBody = z.object({
  name: z.string().trim().min(1).max(160),
  adapter_key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  config: z.record(z.string(), z.json()).default({}),
  enabled: z.boolean().default(false),
  max_concurrency: z.number().int().min(1).max(100).default(1),
  current_year_reserve_percent: z.number().min(0).max(100).default(30),
  missing_cycles_threshold: z.number().int().min(1).max(1000).default(3),
  log_retention_days: z.number().int().min(1).max(3650).default(30)
}).strict();
const providerPatch = z.object({
  name: providerBody.shape.name.optional(),
  adapter_key: providerBody.shape.adapter_key.optional(),
  config: z.record(z.string(), z.json()).optional(),
  enabled: z.boolean().optional(),
  max_concurrency: z.number().int().min(1).max(100).optional(),
  current_year_reserve_percent: z.number().min(0).max(100).optional(),
  missing_cycles_threshold: z.number().int().min(1).max(1000).optional(),
  log_retention_days: z.number().int().min(1).max(3650).optional()
}).strict();
const secretBody = z.object({ value: z.string().min(1).max(8192) }).strict();
const secretParams = z.object({ id: uuid, name: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/) });
const quotaBody = z.object({
  short_window_seconds: z.number().int().positive().nullable().default(null),
  short_limit: z.number().int().positive().nullable().default(null),
  monthly_limit: z.number().int().positive().nullable().default(null),
  limits_source: z.enum(['configured','provider_headers','hybrid']).default('configured'),
  reset_timezone: z.string().trim().min(1).max(80).nullable().default(null),
  reset_at: z.string().datetime({ offset: true }).nullable().default(null)
}).strict().refine((value) => (value.short_window_seconds === null) === (value.short_limit === null), {
  message: 'La fenêtre et la limite court terme doivent être fournies ensemble.'
});

const mutationContext = (request: FastifyRequest) => ({
  principal: (request as FastifyRequest & { adminPrincipal: AdminPrincipal }).adminPrincipal,
  requestId: request.id
});
const input = (value: z.infer<typeof providerBody>) => ({
  name: value.name, adapterKey: value.adapter_key, config: value.config as JsonObject, enabled: value.enabled,
  maxConcurrency: value.max_concurrency, currentYearReservePercent: value.current_year_reserve_percent,
  missingCyclesThreshold: value.missing_cycles_threshold, logRetentionDays: value.log_retention_days
});
const fail = (reply: { code(status: number): { send(value: unknown): unknown } }, error: unknown) => {
  if (error instanceof ProviderMasterKeyError) return reply.code(503).send({ message: error.message });
  const status = Number((error as { statusCode?: number }).statusCode ?? 500);
  if (status < 500) return reply.code(status).send({ message: (error as Error).message });
  throw error;
};

export async function providerRoutes(app: FastifyInstance, options: { service: ProviderConfigurationService }): Promise<void> {
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
      name:current.name,adapter_key:current.adapter_key,config:current.config,enabled:current.enabled,
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
    return await service.quotaPolicy(id.data) ?? { provider_instance_id:id.data, short_window_seconds:null, short_limit:null, monthly_limit:null, limits_source:'configured', reset_timezone:null, reset_at:null };
  });
  app.put('/api/v1/admin/providers/:id/quota-policy', async (request, reply) => {
    const id = uuid.safeParse((request.params as {id:string}).id); const body = quotaBody.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({message:'Politique de quota invalide.'});
    const value = body.data; const result = await service.setQuotaPolicy(id.data,{shortWindowSeconds:value.short_window_seconds,shortLimit:value.short_limit,monthlyLimit:value.monthly_limit,limitsSource:value.limits_source,resetTimezone:value.reset_timezone,resetAt:value.reset_at},mutationContext(request));
    if (!result) return reply.code(404).send({message:'Fournisseur introuvable.'}); markAtomicallyAudited(request); return result;
  });
}
