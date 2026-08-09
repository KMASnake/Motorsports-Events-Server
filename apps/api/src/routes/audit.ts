import type { FastifyInstance } from 'fastify';
import { auditQuery, paginated } from '../lib/adminQuery.js';
import { pool } from '../lib/db.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/admin/audit', async (request, reply) => {
    const parsed = auditQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsed.error.issues });
    const query = parsed.data; const params: unknown[] = []; const where: string[] = [];
    if (query.resource_type) { params.push(query.resource_type); where.push(`resource_type=$${params.length}`); }
    const whereSql = where.length ? ` where ${where.join(' and ')}` : '';
    const total = Number((await pool.query(`select count(*)::int total from admin_audit_log${whereSql}`, params)).rows[0].total);
    params.push(query.page_size, (query.page - 1) * query.page_size);
    const items = (await pool.query(`select * from admin_audit_log${whereSql} order by created_at desc,id desc limit $${params.length - 1} offset $${params.length}`, params)).rows;
    return paginated(items, total, query.page, query.page_size);
  });
}
