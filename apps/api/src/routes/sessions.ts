import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { paginated } from '../lib/adminQuery.js';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { pool, withTransaction } from '../lib/db.js';
import {
  createSessionBody,
  normalizedSessionDates,
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
  app.get('/api/v1/admin/session-titles', async () => (
    await pool.query(`select name title,count(*)::int usage_count
      from sessions where btrim(name)<>'' group by name order by lower(name),name`)
  ).rows);

  // Compatibilité technique avec la migration 0004 ; ce référentiel n'est
  // pas exposé comme deuxième champ dans le workflow métier.
  app.get('/api/v1/admin/session-types', async () => (
    await pool.query('select key,label,sort_order,active from session_types order by sort_order,key')
  ).rows);

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
