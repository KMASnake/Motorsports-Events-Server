import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../lib/db.js';
import {
  applyProviderPatch,
  lockEvent,
  reconcileAdministrativePatch,
  updateEventFields,
  type CorrectableEventPatch
} from '../lib/eventCorrections.js';

const nullableText = z.union([z.string().trim().max(2000), z.null()]).optional();
const eventStatus = z.enum(['draft', 'scheduled', 'completed', 'cancelled', 'postponed']);
const eventOrigin = z.enum(['manual', 'provider', 'mixed']);
const eventBody = z.object({
  championship_id: z.string().trim().min(1),
  circuit_id: z.union([z.string().trim().min(1), z.null()]).optional(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: nullableText,
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
  timezone: z.string().trim().min(1).max(80).default('Europe/Paris'),
  status: eventStatus.default('scheduled'),
  published: z.boolean().default(true),
  origin: eventOrigin.default('manual'),
  provider_key: nullableText,
  external_id: nullableText,
  description: nullableText
});
const updateBody = eventBody.partial();
const providerUpdateBody = eventBody.pick({
  championship_id: true,
  circuit_id: true,
  name: true,
  slug: true,
  category: true,
  starts_at: true,
  ends_at: true,
  timezone: true,
  status: true,
  published: true,
  description: true
}).partial().refine((value) => Object.keys(value).length > 0, 'Aucune valeur fournisseur à synchroniser.');

const publicSelect = `
  select e.id,e.slug,e.name,e.category,e.starts_at,e.ends_at,e.timezone,e.status,e.description,
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
    clean(body.provider_key), clean(body.external_id), clean(body.description)];
}
function validateDates(body: z.infer<typeof eventBody>): string | null {
  if (body.ends_at && new Date(body.ends_at) < new Date(body.starts_at)) {
    return 'La date de fin doit être postérieure ou égale à la date de début.';
  }
  return null;
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/events', async (request) => {
    const query = request.query as { championship_id?: string; status?: string; from?: string; to?: string };
    const where = ['e.published=true', 'c.active=true', `e.status <> 'draft'`];
    const params: unknown[] = [];
    if (query.championship_id) { params.push(query.championship_id); where.push(`e.championship_id=$${params.length}`); }
    if (query.status && eventStatus.safeParse(query.status).success) { params.push(query.status); where.push(`e.status=$${params.length}`); }
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

  app.get('/api/v1/admin/events', async (request) => {
    const query = request.query as { search?: string; championship_id?: string; status?: string; published?: string; from?: string; to?: string };
    const where: string[] = []; const params: unknown[] = [];
    if (query.search?.trim()) { params.push(`%${query.search.trim()}%`); where.push(`(e.name ilike $${params.length} or e.slug ilike $${params.length} or coalesce(ci.name,'') ilike $${params.length})`); }
    if (query.championship_id) { params.push(query.championship_id); where.push(`e.championship_id=$${params.length}`); }
    if (query.status && eventStatus.safeParse(query.status).success) { params.push(query.status); where.push(`e.status=$${params.length}`); }
    if (query.published === 'true' || query.published === 'false') { params.push(query.published === 'true'); where.push(`e.published=$${params.length}`); }
    if (query.from) { params.push(query.from); where.push(`e.starts_at >= $${params.length}::timestamptz`); }
    if (query.to) { params.push(query.to); where.push(`e.starts_at <= $${params.length}::timestamptz`); }
    return (await pool.query(`${adminSelect}${where.length ? ` where ${where.join(' and ')}` : ''} order by e.starts_at,e.name`, params)).rows;
  });

  app.get('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${adminSelect} where e.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Événement introuvable.' });
    return result.rows[0];
  });

  app.post('/api/v1/admin/events', async (request, reply) => {
    const parsed = eventBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const dateError = validateDates(parsed.data); if (dateError) return reply.code(400).send({ message: dateError });
    const championship = await pool.query('select id from championships where id=$1', [parsed.data.championship_id]);
    if (!championship.rowCount) return reply.code(400).send({ message: 'Le championnat sélectionné n’existe pas.' });
    try {
      const result = await pool.query(`insert into events(
        id,championship_id,circuit_id,name,slug,category,starts_at,ends_at,timezone,status,published,
        origin,provider_key,external_id,description
      ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`, [randomUUID(), ...values(parsed.data)]);
      return reply.code(201).send(result.rows[0]);
    } catch (error: unknown) {
      const code=(error as {code?:string}).code;
      if (code==='23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      if (code==='23503') return reply.code(400).send({ message: 'Le championnat ou le circuit sélectionné n’existe pas.' });
      throw error;
    }
  });

  app.patch('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const requested = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([field]) => field in requested));
    try {
      const updated = await withTransaction(async (client) => {
        const current = await lockEvent(client, id);
        if (!current) return null;
        const merged = eventBody.parse({ ...current, ...patch,
          starts_at: new Date((patch.starts_at as string | undefined) ?? current.starts_at as string | Date).toISOString(),
          ends_at: patch.ends_at === undefined ? (current.ends_at ? new Date(current.ends_at as string | Date).toISOString() : null) : patch.ends_at
        });
        const dateError = validateDates(merged);
        if (dateError) throw new EventValidationError(dateError);
        await reconcileAdministrativePatch(client, current, patch as CorrectableEventPatch);
        const result = await client.query(`update events set championship_id=$2,circuit_id=$3,name=$4,slug=$5,
          category=$6,starts_at=$7,ends_at=$8,timezone=$9,status=$10,published=$11,origin=$12,
          provider_key=$13,external_id=$14,description=$15,updated_at=now() where id=$1 returning *`, [id, ...values(merged)]);
        return result.rows[0];
      });
      if (!updated) return reply.code(404).send({ message: 'Événement introuvable.' });
      return updated;
    } catch (error: unknown) {
      if (error instanceof EventValidationError) return reply.code(400).send({ message: error.message });
      const code=(error as {code?:string}).code;
      if (code==='23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
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
          starts_at: new Date((effectivePatch.starts_at ?? current.starts_at) as string | Date).toISOString(),
          ends_at: effectivePatch.ends_at === undefined ? (current.ends_at ? new Date(current.ends_at as string | Date).toISOString() : null) : effectivePatch.ends_at
        });
        const dateError = validateDates(merged);
        if (dateError) throw new EventValidationError(dateError);
        return updateEventFields(client, id, effectivePatch);
      });
      if (!updated) return reply.code(404).send({ message: 'Événement introuvable.' });
      return updated;
    } catch (error) {
      if (error instanceof EventValidationError) return reply.code(400).send({ message: error.message });
      if ((error as Error).message.includes('événement manuel')) return reply.code(409).send({ message: (error as Error).message });
      throw error;
    }
  });

  app.delete('/api/v1/admin/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query('delete from events where id=$1 returning id', [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Événement introuvable.' });
    return reply.code(204).send();
  });
}

class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}
