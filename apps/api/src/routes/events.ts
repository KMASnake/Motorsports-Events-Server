import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../lib/db.js';
import { EVENT_STORAGE_TIMEZONE, uniqueEventSlug } from '../lib/eventMetadata.js';
import {
  applyProviderPatch,
  lockEvent,
  reconcileAdministrativePatch,
  updateEventFields,
  type CorrectableEventPatch
} from '../lib/eventCorrections.js';
import { adminEventQuery, paginated, publicEventQuery } from '../lib/adminQuery.js';
import { markAtomicallyAudited, writeAdminAudit } from '../lib/adminAudit.js';
import { assertCorrectionSafeEvent, IncompleteProviderIdentityError } from '../lib/correctionPolicy.js';

const nullableText = z.union([z.string().trim().max(2000), z.null()]).optional();
const nullableSessionTitle = z.union([z.string().trim().min(1).max(160), z.null()]).optional();
const eventStatus = z.enum(['draft', 'scheduled', 'completed', 'cancelled', 'postponed']);
const eventOrigin = z.enum(['manual', 'provider', 'mixed']);
const businessEventBody = z.object({
  championship_id: z.string().trim().min(1),
  circuit_id: z.union([z.string().trim().min(1), z.null()]).optional(),
  name: z.string().trim().min(2).max(160),
  category: nullableText,
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
  status: eventStatus.default('scheduled'),
  published: z.boolean().default(true),
  session_title: nullableSessionTitle,
  description: nullableText
});
const eventBody = businessEventBody.extend({
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.string().trim().min(1).max(80),
  origin: eventOrigin,
  provider_key: nullableText,
  external_id: nullableText
});
const updateBody = businessEventBody.partial();
const providerCreateBody = businessEventBody.extend({
  provider_key: z.string().trim().min(1).max(120),
  external_id: z.string().trim().min(1).max(300)
});
const providerUpdateBody = eventBody.pick({
  championship_id: true,
  circuit_id: true,
  name: true,
  slug: true,
  category: true,
  starts_at: true,
  ends_at: true,
  status: true,
  published: true,
  session_title: true,
  description: true
}).partial().refine((value) => Object.keys(value).length > 0, 'Aucune valeur fournisseur à synchroniser.');
const technicalAdminFields = ['slug', 'timezone', 'origin', 'provider_key', 'external_id'] as const;

const publicSelect = `
  select e.id,e.slug,e.name,e.category,e.starts_at,e.ends_at,e.timezone,e.status,e.session_title,e.description,
    c.id championship_id,c.slug championship_slug,c.name championship_name,c.short_name championship_short_name,
    ci.id circuit_id,ci.name circuit_name,ci.city circuit_city,ci.country_code
  from events e
  join championships c on c.id=e.championship_id
  left join circuits ci on ci.id=e.circuit_id
`;
const adminSelect = `
  select e.*,c.name championship_name,c.slug championship_slug,c.logo_url championship_logo_url,c.active championship_active,
    ci.name circuit_name,ci.city circuit_city,ci.country_code,
    (select count(*)::int from event_corrections ec where ec.event_id=e.id and ec.status in ('active','conflict')) correction_count
  from events e
  join championships c on c.id=e.championship_id
  left join circuits ci on ci.id=e.circuit_id
`;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result ? result : null;
}
function values(body: z.infer<typeof eventBody>) {
  return [body.championship_id, clean(body.circuit_id), body.name, body.slug, clean(body.category),
    body.starts_at, clean(body.ends_at), body.timezone, body.status, body.published, body.origin,
    clean(body.provider_key), clean(body.external_id), clean(body.session_title), clean(body.description)];
}
function validateDates(body: z.infer<typeof eventBody>): string | null {
  if (body.ends_at && new Date(body.ends_at) < new Date(body.starts_at)) {
    return 'La date de fin doit être postérieure ou égale à la date de début.';
  }
  return null;
}

function technicalFieldsIn(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return technicalAdminFields.filter((field) => field in body);
}

export interface EventRouteOptions { includePublic?: boolean }

export async function eventRoutes(app: FastifyInstance, options: EventRouteOptions = {}): Promise<void> {
  if (options.includePublic !== false) {
    app.get('/api/v1/events', async (request, reply) => {
      const parsedQuery = publicEventQuery.safeParse(request.query);
      if (!parsedQuery.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsedQuery.error.issues });
      const query = parsedQuery.data;
      const where = ['e.published=true', 'c.active=true', `e.status <> 'draft'`];
      const params: unknown[] = [];
      if (query.championship_id) { params.push(query.championship_id); where.push(`e.championship_id=$${params.length}`); }
      if (query.status) { params.push(query.status); where.push(`e.status=$${params.length}`); }
      if (query.from) { params.push(query.from); where.push(`e.starts_at >= $${params.length}::timestamptz`); }
      if (query.to) { params.push(query.to); where.push(`e.starts_at <= $${params.length}::timestamptz`); }
      return (await pool.query(`${publicSelect} where ${where.join(' and ')} order by e.starts_at,e.name`, params)).rows;
    });

    app.get('/api/v1/events/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await pool.query(`${publicSelect} where e.id=$1 and e.published=true and c.active=true and e.status <> 'draft'`, [id]);
      if (!result.rowCount) return reply.code(404).send({ message: 'Événement introuvable.' });
      return result.rows[0];
    });
  }

  app.get('/api/v1/admin/events', async (request, reply) => {
    const parsedQuery = adminEventQuery.safeParse(request.query);
    if (!parsedQuery.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsedQuery.error.issues });
    const query = parsedQuery.data;
    const where: string[] = []; const params: unknown[] = [];
    if (query.search?.trim()) { params.push(`%${query.search.trim()}%`); where.push(`(e.name ilike $${params.length} or e.slug ilike $${params.length} or coalesce(ci.name,'') ilike $${params.length})`); }
    if (query.championship_id) { params.push(query.championship_id); where.push(`e.championship_id=$${params.length}`); }
    if (query.status) { params.push(query.status); where.push(`e.status=$${params.length}`); }
    if (query.published === 'true' || query.published === 'false') { params.push(query.published === 'true'); where.push(`e.published=$${params.length}`); }
    if (query.from) { params.push(query.from); where.push(`e.starts_at >= $${params.length}::timestamptz`); }
    if (query.to) { params.push(query.to); where.push(`e.starts_at <= $${params.length}::timestamptz`); }
    const whereSql = where.length ? ` where ${where.join(' and ')}` : '';
    const sortColumns = { starts_at: 'e.starts_at', name: 'e.name', championship: 'c.name', status: 'e.status', updated_at: 'e.updated_at' } as const;
    const order = `${sortColumns[query.sort]} ${query.direction},e.id asc`;
    if (!query.page) return (await pool.query(`${adminSelect}${whereSql} order by ${order}`, params)).rows;
    const total = Number((await pool.query(`select count(*)::int total from events e join championships c on c.id=e.championship_id left join circuits ci on ci.id=e.circuit_id${whereSql}`, params)).rows[0].total);
    params.push(query.page_size, (query.page - 1) * query.page_size);
    const items = (await pool.query(`${adminSelect}${whereSql} order by ${order} limit $${params.length - 1} offset $${params.length}`, params)).rows;
    return paginated(items, total, query.page, query.page_size);
  });

  app.get('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${adminSelect} where e.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Événement introuvable.' });
    return result.rows[0];
  });

  app.post('/api/v1/admin/events', async (request, reply) => {
    const technicalFields = technicalFieldsIn(request.body);
    if (technicalFields.length) return reply.code(400).send({
      message: `Les champs techniques suivants sont calculés par le serveur : ${technicalFields.join(', ')}.`
    });
    const parsed = businessEventBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const dateError = validateDates(parsed.data as z.infer<typeof eventBody>); if (dateError) return reply.code(400).send({ message: dateError });
    const championship = await pool.query('select id from championships where id=$1', [parsed.data.championship_id]);
    if (!championship.rowCount) return reply.code(400).send({ message: 'Le championnat sélectionné n’existe pas.' });
    try {
      const created = await withTransaction(async (client) => {
        const complete = eventBody.parse({
          ...parsed.data,
          slug: await uniqueEventSlug(client, parsed.data.name),
          timezone: EVENT_STORAGE_TIMEZONE,
          origin: 'manual',
          provider_key: null,
          external_id: null
        });
        const result = await client.query(`insert into events(
          id,championship_id,circuit_id,name,slug,category,starts_at,ends_at,timezone,status,published,
          origin,provider_key,external_id,session_title,description
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`, [randomUUID(), ...values(complete)]);
        await writeAdminAudit(client, { request, resourceType: 'event', resourceId: result.rows[0].id, oldValue: null, newValue: result.rows[0] });
        return result.rows[0];
      });
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error: unknown) {
      const code=(error as {code?:string}).code;
      if (code==='23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      if (code==='23503') return reply.code(400).send({ message: 'Le championnat ou le circuit sélectionné n’existe pas.' });
      throw error;
    }
  });

  app.patch('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const technicalFields = technicalFieldsIn(request.body);
    if (technicalFields.length) return reply.code(400).send({
      message: `Les champs techniques suivants sont calculés par le serveur : ${technicalFields.join(', ')}.`
    });
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const requested = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([field]) => field in requested));
    try {
      const updated = await withTransaction(async (client) => {
        const current = await lockEvent(client, id);
        if (!current) return null;
        assertCorrectionSafeEvent(current);
        const merged = eventBody.parse({ ...current, ...patch,
          timezone: EVENT_STORAGE_TIMEZONE,
          starts_at: new Date((patch.starts_at as string | undefined) ?? current.starts_at as string | Date).toISOString(),
          ends_at: patch.ends_at === undefined ? (current.ends_at ? new Date(current.ends_at as string | Date).toISOString() : null) : patch.ends_at
        });
        const dateError = validateDates(merged);
        if (dateError) throw new EventValidationError(dateError);
        await reconcileAdministrativePatch(client, current, patch as CorrectableEventPatch);
        const result = await client.query(`update events set championship_id=$2,circuit_id=$3,name=$4,slug=$5,
          category=$6,starts_at=$7,ends_at=$8,timezone=$9,status=$10,published=$11,origin=$12,
          provider_key=$13,external_id=$14,session_title=$15,description=$16,updated_at=now() where id=$1 returning *`, [id, ...values(merged)]);
        await writeAdminAudit(client, { request, resourceType: 'event', resourceId: id, oldValue: current, newValue: result.rows[0] });
        return result.rows[0];
      });
      if (!updated) return reply.code(404).send({ message: 'Événement introuvable.' });
      markAtomicallyAudited(request);
      return updated;
    } catch (error: unknown) {
      if (error instanceof IncompleteProviderIdentityError) return reply.code(409).send({ message: error.message, code: 'provider_identity_incomplete' });
      if (error instanceof EventValidationError) return reply.code(400).send({ message: error.message });
      const code=(error as {code?:string}).code;
      if (code==='23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      if (code==='23503') return reply.code(400).send({ message: 'Le championnat ou le circuit sélectionné n’existe pas.' });
      throw error;
    }
  });

  app.post('/api/v1/admin/provider-events', async (request, reply) => {
    const parsed = providerCreateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données fournisseur invalides.', issues: parsed.error.issues });
    const dateError = validateDates(parsed.data as z.infer<typeof eventBody>);
    if (dateError) return reply.code(400).send({ message: dateError });
    try {
      const created = await withTransaction(async (client) => {
        const complete = eventBody.parse({
          ...parsed.data,
          slug: await uniqueEventSlug(client, parsed.data.name),
          timezone: EVENT_STORAGE_TIMEZONE,
          origin: 'provider'
        });
        const result = await client.query(`insert into events(
          id,championship_id,circuit_id,name,slug,category,starts_at,ends_at,timezone,status,published,
          origin,provider_key,external_id,session_title,description
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`, [randomUUID(), ...values(complete)]);
        await writeAdminAudit(client, { request, resourceType: 'provider-event', resourceId: result.rows[0].id, oldValue: null, newValue: result.rows[0] });
        return result.rows[0];
      });
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error: unknown) {
      const code=(error as {code?:string}).code;
      if (code==='23505') return reply.code(409).send({ message: 'Cet événement fournisseur existe déjà.' });
      if (code==='23503') return reply.code(400).send({ message: 'Le championnat ou le circuit sélectionné n’existe pas.' });
      throw error;
    }
  });

  app.post('/api/v1/admin/events/:id/provider-sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = providerUpdateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données fournisseur invalides.', issues: parsed.error.issues });
    try {
      const updated = await withTransaction(async (client) => {
        const current = await lockEvent(client, id);
        if (!current) return null;
        const effectivePatch = await applyProviderPatch(client, current, parsed.data as CorrectableEventPatch);
        const merged = eventBody.parse({ ...current, ...effectivePatch,
          timezone: EVENT_STORAGE_TIMEZONE,
          starts_at: new Date((effectivePatch.starts_at ?? current.starts_at) as string | Date).toISOString(),
          ends_at: effectivePatch.ends_at === undefined ? (current.ends_at ? new Date(current.ends_at as string | Date).toISOString() : null) : effectivePatch.ends_at
        });
        const dateError = validateDates(merged);
        if (dateError) throw new EventValidationError(dateError);
        const result = await updateEventFields(client, id, effectivePatch);
        await writeAdminAudit(client, { request, resourceType: 'event', resourceId: id, oldValue: current, newValue: result });
        return result;
      });
      if (!updated) return reply.code(404).send({ message: 'Événement introuvable.' });
      markAtomicallyAudited(request);
      return updated;
    } catch (error) {
      if (error instanceof EventValidationError) return reply.code(400).send({ message: error.message });
      if ((error as Error).message.includes('événement manuel')) return reply.code(409).send({ message: (error as Error).message });
      throw error;
    }
  });

  app.delete('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await withTransaction(async (client) => {
      const current = await client.query('select * from events where id=$1 for update', [id]);
      if (!current.rowCount) return false;
      await client.query('delete from events where id=$1', [id]);
      await writeAdminAudit(client, { request, resourceType: 'event', resourceId: id, oldValue: current.rows[0], newValue: null });
      return true;
    });
    if (!deleted) return reply.code(404).send({ message: 'Événement introuvable.' });
    markAtomicallyAudited(request);
    return reply.code(204).send();
  });
}

class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}
