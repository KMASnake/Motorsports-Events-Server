import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../lib/db.js';

const nullableText = z.union([z.string().trim().max(500), z.null()]).optional();
const championshipBody = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  short_name: nullableText,
  official_name: nullableText,
  category: nullableText,
  season: z.coerce.number().int().min(1950).max(2200).default(new Date().getFullYear()),
  active: z.boolean().default(true),
  sync_enabled: z.boolean().default(false),
  provider_key: nullableText,
  external_id: nullableText,
  logo_url: nullableText,
  description: nullableText
});

const updateBody = championshipBody.partial();

const selectSql = `
  select c.*,
    count(e.id)::int as event_count
  from championships c
  left join events e on e.championship_id = c.id
`;

function cleanNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length ? clean : null;
}

function dbValues(body: z.infer<typeof championshipBody>) {
  return [
    body.slug,
    body.name,
    cleanNullable(body.short_name),
    cleanNullable(body.official_name),
    cleanNullable(body.category),
    body.season,
    body.active,
    body.sync_enabled,
    cleanNullable(body.provider_key),
    cleanNullable(body.external_id),
    cleanNullable(body.logo_url),
    cleanNullable(body.description)
  ];
}

export async function championshipRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/championships', async (request) => {
    const query = request.query as { search?: string; status?: string; season?: string };
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      where.push(`(c.name ilike $${values.length} or c.slug ilike $${values.length} or coalesce(c.official_name,'') ilike $${values.length})`);
    }
    if (query.status === 'active' || query.status === 'inactive') {
      values.push(query.status === 'active');
      where.push(`c.active = $${values.length}`);
    }
    if (query.season && /^\d{4}$/.test(query.season)) {
      values.push(Number(query.season));
      where.push(`c.season = $${values.length}`);
    }

    const result = await pool.query(
      `${selectSql}${where.length ? ` where ${where.join(' and ')}` : ''} group by c.id order by c.name`,
      values
    );
    return result.rows;
  });

  app.get('/api/v1/championships/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`${selectSql} where c.id=$1 group by c.id`, [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Championnat introuvable.' });
    return result.rows[0];
  });

  app.post('/api/v1/championships', async (request, reply) => {
    const parsed = championshipBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    if (parsed.data.sync_enabled && !cleanNullable(parsed.data.provider_key)) {
      return reply.code(400).send({ message: 'Un provider doit être sélectionné lorsque la synchronisation est activée.' });
    }
    const id = randomUUID();
    try {
      const result = await pool.query(
        `insert into championships(
          id,slug,name,short_name,official_name,category,season,active,sync_enabled,
          provider_key,external_id,logo_url,description
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [id, ...dbValues(parsed.data)]
      );
      return reply.code(201).send(result.rows[0]);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      throw error;
    }
  });

  app.patch('/api/v1/championships/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    const current = await pool.query('select * from championships where id=$1', [id]);
    if (!current.rowCount) return reply.code(404).send({ message: 'Championnat introuvable.' });
    const merged = championshipBody.parse({ ...current.rows[0], ...parsed.data });
    if (merged.sync_enabled && !cleanNullable(merged.provider_key)) {
      return reply.code(400).send({ message: 'Un provider doit être sélectionné lorsque la synchronisation est activée.' });
    }
    try {
      const result = await pool.query(
        `update championships set
          slug=$2,name=$3,short_name=$4,official_name=$5,category=$6,season=$7,
          active=$8,sync_enabled=$9,provider_key=$10,external_id=$11,logo_url=$12,
          description=$13,updated_at=now()
        where id=$1 returning *`,
        [id, ...dbValues(merged)]
      );
      return result.rows[0];
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      throw error;
    }
  });

  app.delete('/api/v1/championships/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const linked = await pool.query('select count(*)::int as count from events where championship_id=$1', [id]);
    if (linked.rows[0].count > 0) {
      return reply.code(409).send({ message: `Suppression impossible : ${linked.rows[0].count} événement(s) sont encore liés à ce championnat.` });
    }
    const result = await pool.query('delete from championships where id=$1 returning id', [id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Championnat introuvable.' });
    return reply.code(204).send();
  });
}
