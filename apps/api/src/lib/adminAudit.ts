import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import type { AdminPrincipal } from './adminAuth.js';

type AuditContext = { actor: string; action: string; resourceType: string; resourceId: string | null; oldValue: unknown };
const contexts = new WeakMap<FastifyRequest, AuditContext>();
const atomicallyAudited = new WeakSet<FastifyRequest>();
const sensitive = /authorization|token|secret|password|cookie/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !sensitive.test(key)).map(([key, child]) => [key, sanitize(child)]));
}
function target(request: FastifyRequest): { type: string; id: string | null; table: string | null } | null {
  const path = request.url.split('?', 1)[0];
  const params = request.params as { id?: string };
  if (path.startsWith('/api/v1/admin/session-corrections')) return { type: 'session-correction', id: params.id ?? null, table: 'session_corrections' };
  if (path.startsWith('/api/v1/admin/providers')) return { type: 'provider', id: params.id ?? null, table: 'provider_instances' };
  if (path.startsWith('/api/v1/admin/provider-sessions')) return { type: 'session-correction-sync', id: params.id ?? null, table: null };
  if (path.startsWith('/api/v1/admin/sessions')) return { type: 'session', id: params.id ?? null, table: 'sessions' };
  if (/^\/api\/v1\/admin\/events\/[^/]+\/sessions$/.test(path)) return { type: 'session', id: null, table: null };
  if (path.startsWith('/api/v1/admin/corrections')) return { type: 'correction', id: params.id ?? null, table: 'event_corrections' };
  if (path === '/api/v1/admin/provider-events') return { type: 'provider-event', id: null, table: null };
  if (path.startsWith('/api/v1/admin/events')) return { type: 'event', id: params.id ?? null, table: 'events' };
  if (path.startsWith('/api/v1/championships')) return { type: 'championship', id: params.id ?? null, table: 'championships' };
  return null;
}

export function registerAdminAudit(app: FastifyInstance): void {
  app.addHook('preHandler', async (request) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return;
    const resource = target(request); if (!resource) return;
    const principal = (request as FastifyRequest & { adminPrincipal?: AdminPrincipal }).adminPrincipal;
    let oldValue: unknown = null;
    if (resource.id && resource.table) oldValue = (await pool.query(`select * from ${resource.table} where id=$1`, [resource.id])).rows[0] ?? null;
    contexts.set(request, { actor: principal?.sub ?? 'unknown', action: `${request.method} ${request.url.split('?', 1)[0]}`, resourceType: resource.type, resourceId: resource.id, oldValue });
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (atomicallyAudited.has(request)) return payload;
    const context = contexts.get(request); if (!context || reply.statusCode >= 400) return payload;
    let newValue: unknown = request.method === 'DELETE' || reply.statusCode === 204 ? null : payload;
    if (typeof newValue === 'string') { try { newValue = JSON.parse(newValue); } catch { /* keep text */ } }
    const resourceId = context.resourceId ?? (newValue && typeof newValue === 'object' ? String((newValue as any).id ?? '') || null : null);
    await pool.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
      values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`, [context.actor, context.action, context.resourceType, resourceId,
      request.id, JSON.stringify(sanitize(context.oldValue)), JSON.stringify(sanitize(newValue))]);
    return payload;
  });
}

export function markAtomicallyAudited(request: FastifyRequest): void {
  atomicallyAudited.add(request);
}
