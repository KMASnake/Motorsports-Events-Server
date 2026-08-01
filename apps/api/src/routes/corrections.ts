import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../lib/db.js';

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
    const parsed = z.object({ override_value: z.unknown() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Valeur locale invalide.' });
    const correction = await pool.query('select * from event_corrections where id=$1', [id]);
    if (!correction.rowCount) return reply.code(404).send({ message: 'Correction introuvable.' });
    const row = correction.rows[0];
    await pool.query(`update events set ${safeField(row.field_name)}=$2,updated_at=now() where id=$1`, [row.event_id, parsed.data.override_value]);
    return (await pool.query(`update event_corrections set override_value=$2::jsonb,status='active',conflict_detected_at=null,updated_at=now() where id=$1 returning *`, [id, JSON.stringify(parsed.data.override_value)])).rows[0];
  });

  app.post('/api/v1/admin/corrections/:id/accept-provider', async (request, reply) => resolve(request, reply, true));
  app.post('/api/v1/admin/corrections/:id/keep-override', async (request, reply) => resolve(request, reply, false));
  app.delete('/api/v1/admin/corrections/:id', async (request, reply) => resolve(request, reply, true, true));
}

const allowedFields = new Set(['championship_id','circuit_id','name','slug','category','starts_at','ends_at','timezone','status','published','description']);
function safeField(field: string) {
  if (!allowedFields.has(field)) throw new Error(`Champ de correction interdit: ${field}`);
  return field;
}

async function resolve(request: any, reply: any, acceptProvider: boolean, deleted = false) {
  const { id } = request.params as { id: string };
  const correction = await pool.query('select * from event_corrections where id=$1', [id]);
  if (!correction.rowCount) return reply.code(404).send({ message: 'Correction introuvable.' });
  const row = correction.rows[0];
  if (acceptProvider) await pool.query(`update events set ${safeField(row.field_name)}=$2,updated_at=now() where id=$1`, [row.event_id, row.provider_value]);
  if (deleted) {
    await pool.query('delete from event_corrections where id=$1', [id]);
    return reply.code(204).send();
  }
  const status = acceptProvider ? 'resolved' : 'active';
  return (await pool.query(`update event_corrections set status=$2,conflict_detected_at=null,updated_at=now() where id=$1 returning *`, [id, status])).rows[0];
}
