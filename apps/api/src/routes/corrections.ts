import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../lib/db.js';
import { resolveCorrection } from '../lib/eventCorrections.js';

const correctionSelect = `
  select ec.*,e.name event_name,e.slug event_slug,e.championship_id,
    c.name championship_name
  from event_corrections ec
  join events e on e.id=ec.event_id
  join championships c on c.id=e.championship_id
`;

export async function correctionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/admin/corrections', async (request) => {
    const query = request.query as { status?: string; conflict?: string; event_id?: string; field?: string };
    const where: string[] = []; const params: unknown[] = [];
    if (query.status) { params.push(query.status); where.push(`ec.status=$${params.length}`); }
    if (query.conflict === 'true') where.push(`ec.status='conflict'`);
    if (query.event_id) { params.push(query.event_id); where.push(`ec.event_id=$${params.length}`); }
    if (query.field) { params.push(query.field); where.push(`ec.field_name=$${params.length}`); }
    return (await pool.query(`${correctionSelect}${where.length ? ` where ${where.join(' and ')}` : ''} order by ec.updated_at desc`, params)).rows;
  });

  app.get('/api/v1/admin/corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${correctionSelect} where ec.id=$1`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Correction introuvable.' });
    return result.rows[0];
  });

  app.patch('/api/v1/admin/corrections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ override_value: z.unknown() })
      .refine((value) => Object.hasOwn(value, 'override_value'), 'Valeur locale absente.')
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeur locale invalide.' });
    try {
      const result = await withTransaction((client) => resolveCorrection(client, id, 'set-override', parsed.data.override_value));
      if (result.deleted) return reply.code(204).send();
      return result.correction;
    } catch (error) {
      if ((error as Error).message === 'Correction introuvable.') return reply.code(404).send({ message: (error as Error).message });
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
