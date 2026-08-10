import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { paginated } from '../lib/adminQuery.js';
import { pool, withTransaction } from '../lib/db.js';
import {
  correctableSessionFields,
  resolveSessionCorrection,
  SessionCorrectionConflictError,
  SessionCorrectionNotFoundError,
  SessionCorrectionValidationError,
  setSessionOverride,
  synchronizeProviderSession
} from '../lib/sessionCorrections.js';
import { providerSessionPatch, sessionCorrectionValue } from '../lib/sessionCorrectionValue.js';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  event_id: z.string().trim().min(1).optional(),
  session_id: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'conflict', 'resolved', 'ignored']).optional(),
  field: z.enum(correctableSessionFields).optional(),
  provider: z.string().trim().min(1).optional(),
  conflict: z.enum(['true', 'false']).optional(),
  sort: z.enum(['updated_at', 'event_name', 'session_title', 'field_name', 'status']).default('updated_at'),
  direction: z.enum(['asc', 'desc']).default('desc')
}).strict();

const correctionSelect = `
  select sc.*,s.event_id,s.name session_title,e.name event_name,
    case sc.field_name
      when 'title' then to_jsonb(s.name)
      when 'starts_at' then to_jsonb(s.starts_at)
      when 'ends_at' then to_jsonb(s.ends_at)
      when 'status' then to_jsonb(s.status)
      when 'published' then to_jsonb(s.published)
      when 'description' then to_jsonb(s.description)
    end effective_value
  from session_corrections sc
  join sessions s on s.id=sc.session_id
  join events e on e.id=s.event_id
`;

function audit(request: FastifyRequest): { actor: string; requestId: string; action: string } {
  const principal = (request as FastifyRequest & { adminPrincipal?: AdminPrincipal }).adminPrincipal;
  return { actor: principal?.sub ?? 'unknown', requestId: request.id, action: `${request.method} ${request.url.split('?', 1)[0]}` };
}

function correctionError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof SessionCorrectionNotFoundError) return reply.code(404).send({ message: error.message });
  if (error instanceof SessionCorrectionConflictError) return reply.code(409).send({ message: error.message });
  if (error instanceof SessionCorrectionValidationError) return reply.code(400).send({ message: error.message });
  const code = (error as { code?: string }).code;
  if (code === '23514' || code === '23503') return reply.code(400).send({ message: 'Valeur de Session invalide.' });
  throw error;
}

export async function sessionCorrectionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/admin/session-corrections', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsed.error.issues });
    const query = parsed.data;
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.event_id) { params.push(query.event_id); where.push(`s.event_id=$${params.length}`); }
    if (query.session_id) { params.push(query.session_id); where.push(`sc.session_id=$${params.length}`); }
    if (query.status) { params.push(query.status); where.push(`sc.status=$${params.length}`); }
    if (query.field) { params.push(query.field); where.push(`sc.field_name=$${params.length}`); }
    if (query.provider) { params.push(query.provider); where.push(`sc.provider_key=$${params.length}`); }
    if (query.conflict === 'true') where.push(`sc.status='conflict'`);
    if (query.conflict === 'false') where.push(`sc.status<>'conflict'`);
    const whereSql = where.length ? ` where ${where.join(' and ')}` : '';
    const sortColumns = {
      updated_at: 'sc.updated_at', event_name: 'e.name', session_title: 's.name',
      field_name: 'sc.field_name', status: 'sc.status'
    } as const;
    const order = `${sortColumns[query.sort]} ${query.direction},sc.id asc`;
    const total = Number((await pool.query(`select count(*)::int total from session_corrections sc
      join sessions s on s.id=sc.session_id join events e on e.id=s.event_id${whereSql}`, params)).rows[0].total);
    params.push(query.page_size, (query.page - 1) * query.page_size);
    const items = (await pool.query(`${correctionSelect}${whereSql} order by ${order}
      limit $${params.length - 1} offset $${params.length}`, params)).rows;
    return paginated(items, total, query.page, query.page_size);
  });

  app.get('/api/v1/admin/session-corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${correctionSelect} where sc.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Correction Session introuvable.' });
    return result.rows[0];
  });

  app.patch('/api/v1/admin/sessions/:id/override', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = sessionCorrectionValue.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeur locale invalide.', issues: parsed.error.issues });
    try {
      const result = await withTransaction((client) => setSessionOverride(client, id, parsed.data, audit(request)));
      markAtomicallyAudited(request);
      if (result.deleted) return reply.code(204).send();
      return result.correction;
    } catch (error) { return correctionError(reply, error); }
  });

  app.post('/api/v1/admin/provider-sessions/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = providerSessionPatch.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeurs fournisseur invalides.', issues: parsed.error.issues });
    try {
      const result = await withTransaction((client) => synchronizeProviderSession(client, id, parsed.data, audit(request)));
      markAtomicallyAudited(request);
      return { ...result, title: result.name };
    } catch (error) { return correctionError(reply, error); }
  });

  app.patch('/api/v1/admin/session-corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = sessionCorrectionValue.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeur locale invalide.', issues: parsed.error.issues });
    try {
      const result = await withTransaction((client) => resolveSessionCorrection(client, id, 'set-override', audit(request), parsed.data));
      markAtomicallyAudited(request);
      if (result.deleted) return reply.code(204).send();
      return result.correction;
    } catch (error) { return correctionError(reply, error); }
  });

  app.post('/api/v1/admin/session-corrections/:id/accept-provider', async (request, reply) =>
    correctionAction(request, reply, 'accept-provider'));
  app.post('/api/v1/admin/session-corrections/:id/keep-override', async (request, reply) =>
    correctionAction(request, reply, 'keep-override'));
  app.delete('/api/v1/admin/session-corrections/:id', async (request, reply) =>
    correctionAction(request, reply, 'restore-provider'));
}

async function correctionAction(
  request: FastifyRequest,
  reply: FastifyReply,
  action: 'accept-provider' | 'keep-override' | 'restore-provider'
): Promise<unknown> {
  const { id } = request.params as { id: string };
  try {
    const result = await withTransaction((client) => resolveSessionCorrection(client, id, action, audit(request)));
    markAtomicallyAudited(request);
    if (result.deleted) return reply.code(204).send();
    return result.correction;
  } catch (error) { return correctionError(reply, error); }
}
