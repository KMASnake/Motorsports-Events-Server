import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { paginated } from '../lib/adminQuery.js';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { pool, withTransaction } from '../lib/db.js';
import {
  createSessionBody,
  normalizedSessionDates,
  publicSessionQuery,
  sessionListQuery,
  updateSessionBody,
  validateSessionPeriod
} from '../lib/sessionContracts.js';
import {
  createManualSession,
  deleteManualSession,
  SessionConflictError,
  SessionReferenceError,
  updateManualSession
} from '../lib/sessionService.js';
import { canonicalTaxonomyKey } from '../lib/taxonomy.js';
import { z } from 'zod';

export const sessionTypeBody = z.object({
  key: canonicalTaxonomyKey,
  label: z.string().trim().min(1).max(120),
  sort_order: z.number().int().min(0).max(100000),
  active: z.boolean().default(true)
}).strict();

const sessionSelect = `
  select s.*,s.name title,st.label type_label,e.name event_name
  from sessions s
  join session_types st on st.key=s.type
  join events e on e.id=s.event_id
`;

function actor(request: FastifyRequest): string {
  return (request as FastifyRequest & { adminPrincipal?: AdminPrincipal }).adminPrincipal?.sub ?? 'unknown';
}

function databaseError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof SessionReferenceError) return reply.code(400).send({ message: error.message });
  if (error instanceof SessionConflictError) return reply.code(409).send({ message: error.message });
  const code = (error as { code?: string }).code;
  if (code === '23503' || code === '23514') return reply.code(400).send({ message: 'Référence ou période de Session invalide.' });
  if (code === '23505') return reply.code(409).send({ message: 'Cette identité de Session existe déjà.' });
  throw error;
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/events/:eventId/sessions', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const parsed = publicSessionQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsed.error.issues });
    const params: unknown[] = [eventId];
    const where = [
      's.event_id=$1', 's.published=true', `s.status <> 'draft'`,
      'e.published=true', `e.status <> 'draft'`, 'c.active=true'
    ];
    if (parsed.data.status) { params.push(parsed.data.status); where.push(`s.status=$${params.length}`); }
    if (parsed.data.from) { params.push(parsed.data.from); where.push(`s.starts_at >= $${params.length}::timestamptz`); }
    if (parsed.data.to) { params.push(parsed.data.to); where.push(`s.starts_at <= $${params.length}::timestamptz`); }
    return (await pool.query(`
      select s.id,s.event_id,s.name title,s.starts_at,s.ends_at,s.status,s.description
      from sessions s
      join events e on e.id=s.event_id
      join championships c on c.id=e.championship_id
      where ${where.join(' and ')}
      order by s.starts_at asc,s.id asc`, params)).rows;
  });

  app.get('/api/v1/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`
      select s.id,s.event_id,s.name title,s.starts_at,s.ends_at,s.status,s.description
      from sessions s
      join events e on e.id=s.event_id
      join championships c on c.id=e.championship_id
      where s.id=$1 and s.published=true and s.status <> 'draft'
        and e.published=true and e.status <> 'draft' and c.active=true`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Session introuvable.' });
    return result.rows[0];
  });

  app.get('/api/v1/admin/session-titles', async () => (
    await pool.query(`with titles(title) as (
      select session_title from events where session_title is not null
      union all
      select name from sessions
      union all
      select provider_value #>> '{}' from session_corrections
        where field_name='title' and jsonb_typeof(provider_value)='string'
      union all
      select override_value #>> '{}' from session_corrections
        where field_name='title' and jsonb_typeof(override_value)='string'
    ) select min(btrim(title)) title,count(*)::int usage_count
      from titles where btrim(title)<>''
      group by lower(btrim(title)) order by lower(min(btrim(title)))`)
  ).rows);

  // Registre de classification réutilisé par Event ; la table sessions reste
  // uniquement une surface de compatibilité historique (ADR-0013).
  app.get('/api/v1/admin/session-types', async () => (
    await pool.query('select key,label,sort_order,active from session_types order by sort_order,key')
  ).rows);
  app.post('/api/v1/admin/session-types', async (request, reply) => {
    const parsed = sessionTypeBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Type de session invalide.', issues: parsed.error.issues });
    try {
      const created = await withTransaction(async (client) => {
        const result = await client.query(`insert into session_types(key,label,sort_order,active)
          values($1,$2,$3,$4) returning *`, [parsed.data.key, parsed.data.label, parsed.data.sort_order, parsed.data.active]);
        await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
          values($1,'session_type.created','session_type',$2,$3,null,$4::jsonb)`, [actor(request), parsed.data.key, request.id, JSON.stringify(result.rows[0])]);
        return result.rows[0];
      });
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: 'Cette clé de type existe déjà.' });
      throw error;
    }
  });
  app.patch('/api/v1/admin/session-types/:key', async (request, reply) => {
    const key = canonicalTaxonomyKey.safeParse((request.params as { key: string }).key);
    const body = sessionTypeBody.omit({ key: true }).partial().strict().safeParse(request.body);
    if (!key.success || !body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ message: 'Type de session invalide.' });
    const updated = await withTransaction(async (client) => {
      const current = await client.query('select * from session_types where key=$1 for update', [key.data]);
      if (!current.rowCount) return null;
      const value = { ...current.rows[0], ...body.data } as { label: string; sort_order: number; active: boolean };
      const result = await client.query(`update session_types set label=$2,sort_order=$3,active=$4 where key=$1 returning *`, [key.data, value.label, value.sort_order, value.active]);
      await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
        values($1,'session_type.updated','session_type',$2,$3,$4::jsonb,$5::jsonb)`, [actor(request), key.data, request.id, JSON.stringify(current.rows[0]), JSON.stringify(result.rows[0])]);
      return result.rows[0];
    });
    if (!updated) return reply.code(404).send({ message: 'Type de session introuvable.' });
    markAtomicallyAudited(request);
    return updated;
  });

  app.get('/api/v1/admin/events/:eventId/sessions', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const parsed = sessionListQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsed.error.issues });
    if (!(await pool.query('select 1 from events where id=$1', [eventId])).rowCount) {
      return reply.code(404).send({ message: 'Événement introuvable.' });
    }
    const query = parsed.data;
    const params: unknown[] = [eventId];
    const where = ['s.event_id=$1'];
    if (query.search) { params.push(`%${query.search}%`); where.push(`(s.name ilike $${params.length} or coalesce(s.description,'') ilike $${params.length})`); }
    if (query.title) { params.push(query.title); where.push(`s.name=$${params.length}`); }
    if (query.status) { params.push(query.status); where.push(`s.status=$${params.length}`); }
    if (query.published) { params.push(query.published === 'true'); where.push(`s.published=$${params.length}`); }
    if (query.from) { params.push(query.from); where.push(`s.starts_at >= $${params.length}::timestamptz`); }
    if (query.to) { params.push(query.to); where.push(`s.starts_at <= $${params.length}::timestamptz`); }
    const whereSql = ` where ${where.join(' and ')}`;
    const sortColumns = { starts_at: 's.starts_at', title: 's.name', status: 's.status', updated_at: 's.updated_at' } as const;
    const order = `${sortColumns[query.sort]} ${query.direction},s.id asc`;
    const total = Number((await pool.query(`select count(*)::int total from sessions s${whereSql}`, params)).rows[0].total);
    params.push(query.page_size, (query.page - 1) * query.page_size);
    const items = (await pool.query(
      `${sessionSelect}${whereSql} order by ${order} limit $${params.length - 1} offset $${params.length}`,
      params
    )).rows;
    return paginated(items, total, query.page, query.page_size);
  });

  app.get('/api/v1/admin/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${sessionSelect} where s.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Session introuvable.' });
    return result.rows[0];
  });

  app.post('/api/v1/admin/events/:eventId/sessions', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const parsed = createSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const body = normalizedSessionDates(parsed.data);
    const periodError = validateSessionPeriod(body.starts_at, body.ends_at);
    if (periodError) return reply.code(400).send({ message: periodError });
    try {
      const created = await withTransaction((client) => createManualSession(client, eventId, body, {
        actor: actor(request), requestId: request.id, action: 'POST /api/v1/admin/events/:eventId/sessions'
      }));
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error) { return databaseError(reply, error); }
  });

  app.patch('/api/v1/admin/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const patch = normalizedSessionDates(parsed.data);
    try {
      const updated = await withTransaction(async (client) => {
        const currentResult = await client.query('select starts_at,ends_at from sessions where id=$1', [id]);
        if (!currentResult.rowCount) return null;
        const current = currentResult.rows[0];
        const startsAt = patch.starts_at ?? new Date(current.starts_at).toISOString();
        const endsAt = 'ends_at' in patch ? patch.ends_at : (current.ends_at ? new Date(current.ends_at).toISOString() : null);
        const periodError = validateSessionPeriod(startsAt, endsAt);
        if (periodError) throw new SessionPeriodError(periodError);
        return updateManualSession(client, id, patch, {
          actor: actor(request), requestId: request.id, action: 'PATCH /api/v1/admin/sessions/:id'
        });
      });
      if (!updated) return reply.code(404).send({ message: 'Session introuvable.' });
      markAtomicallyAudited(request);
      return updated;
    } catch (error) {
      if (error instanceof SessionPeriodError) return reply.code(400).send({ message: error.message });
      return databaseError(reply, error);
    }
  });

  app.delete('/api/v1/admin/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await withTransaction((client) => deleteManualSession(client, id, {
        actor: actor(request), requestId: request.id, action: 'DELETE /api/v1/admin/sessions/:id'
      }));
      if (!deleted) return reply.code(404).send({ message: 'Session introuvable.' });
      markAtomicallyAudited(request);
      return reply.code(204).send();
    } catch (error) { return databaseError(reply, error); }
  });
}

class SessionPeriodError extends Error {}
