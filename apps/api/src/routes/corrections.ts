import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../lib/db.js';
import { resolveCorrection } from '../lib/eventCorrections.js';
import { correctionOverrideBody, correctionReference } from '../lib/correctionValue.js';
import { correctionQuery, paginated } from '../lib/adminQuery.js';

const correctionSelect = `
  select ec.*,e.name event_name,e.slug event_slug,e.championship_id,
    c.name championship_name
  from event_corrections ec
  join events e on e.id=ec.event_id
  join championships c on c.id=e.championship_id
`;

export async function correctionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/admin/corrections', async (request, reply) => {
    const parsedQuery = correctionQuery.safeParse(request.query);
    if (!parsedQuery.success) return reply.code(400).send({ message: 'Filtres invalides.', issues: parsedQuery.error.issues });
    const query = parsedQuery.data;
    const where: string[] = []; const params: unknown[] = [];
    if (query.status) { params.push(query.status); where.push(`ec.status=$${params.length}`); }
    if (query.conflict === 'true') where.push(`ec.status='conflict'`);
    if (query.event_id) { params.push(query.event_id); where.push(`ec.event_id=$${params.length}`); }
    if (query.field) { params.push(query.field); where.push(`ec.field_name=$${params.length}`); }
    if (query.provider) { params.push(query.provider); where.push(`ec.provider_key=$${params.length}`); }
    if (query.championship_id) { params.push(query.championship_id); where.push(`e.championship_id=$${params.length}`); }
    const whereSql = where.length ? ` where ${where.join(' and ')}` : '';
    const sortColumns = { updated_at: 'ec.updated_at', event_name: 'e.name', field_name: 'ec.field_name', status: 'ec.status' } as const;
    const order = `${sortColumns[query.sort]} ${query.direction},ec.id asc`;
    if (!query.page) return (await pool.query(`${correctionSelect}${whereSql} order by ${order}`, params)).rows;
    const total = Number((await pool.query(`select count(*)::int total from event_corrections ec join events e on e.id=ec.event_id join championships c on c.id=e.championship_id${whereSql}`, params)).rows[0].total);
    params.push(query.page_size, (query.page - 1) * query.page_size);
    const items = (await pool.query(`${correctionSelect}${whereSql} order by ${order} limit $${params.length - 1} offset $${params.length}`, params)).rows;
    return paginated(items, total, query.page, query.page_size);
  });

  app.get('/api/v1/admin/corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${correctionSelect} where ec.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Correction introuvable.' });
    return result.rows[0];
  });

  app.patch('/api/v1/admin/corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = correctionOverrideBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeur locale invalide.', issues: parsed.error.issues });
    const reference = correctionReference(parsed.data);
    if (reference) {
      const exists = await pool.query(`select id from ${reference.table} where id=$1`, [reference.id]);
      if (!exists.rowCount) return reply.code(400).send({ message: 'La référence sélectionnée n’existe pas.' });
    }
    try {
      const result = await withTransaction((client) => resolveCorrection(
        client, id, 'set-override', parsed.data.override_value, parsed.data.field_name
      ));
      if (result.deleted) return reply.code(204).send();
      return result.correction;
    } catch (error) {
      if ((error as Error).message === 'Correction introuvable.') return reply.code(404).send({ message: (error as Error).message });
      if ((error as Error).message.includes('ne correspond pas')) return reply.code(400).send({ message: (error as Error).message });
      throw error;
    }
  });

  app.post('/api/v1/admin/corrections/:id/accept-provider', async (request, reply) => correctionAction(request, reply, 'accept-provider'));
  app.post('/api/v1/admin/corrections/:id/keep-override', async (request, reply) => correctionAction(request, reply, 'keep-override'));
  app.delete('/api/v1/admin/corrections/:id', async (request, reply) => correctionAction(request, reply, 'delete-override'));
}

async function correctionAction(request: any, reply: any, action: 'accept-provider' | 'keep-override' | 'delete-override') {
  const { id } = request.params as { id: string };
  try {
    const result = await withTransaction((client) => resolveCorrection(client, id, action));
    if (result.deleted) return reply.code(204).send();
    return result.correction;
  } catch (error) {
    if ((error as Error).message === 'Correction introuvable.') return reply.code(404).send({ message: (error as Error).message });
    throw error;
  }
}
