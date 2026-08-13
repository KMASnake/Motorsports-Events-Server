import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../lib/db.js';
import { markAtomicallyAudited, writeAdminAudit } from '../lib/adminAudit.js';
import { uuidParam } from '../lib/routeParams.js';

const nullableText = z.union([z.string().trim().max(500), z.null()]).optional();
const nullableHttpUrl = z.union([
  z.string().trim().max(500).url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  z.literal(''), z.null()
]).optional();
export const championshipBody = z.object({
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
  logo_url: nullableHttpUrl,
  description: nullableText
}).strict();

const updateBody = championshipBody.partial();

const publicSelectSql = `
  select c.id,c.slug,c.name,c.short_name,c.official_name,c.category,c.season,c.logo_url,c.description,
    count(e.id)::int as event_count
  from championships c
  left join events e on e.championship_id = c.id
`;
const adminSelectSql = `
  select c.id,c.slug,c.name,c.short_name,c.official_name,c.category,c.season,c.active,c.sync_enabled,
    c.provider_key,c.external_id,c.logo_url,c.description,c.created_at,c.updated_at,
    count(e.id)::int as event_count
  from championships c left join events e on e.championship_id=c.id
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
  app.get('/api/v1/championships', async (request, reply) => {
    const parsed = z.object({ search: z.string().trim().max(160).optional(), season: z.coerce.number().int().min(1950).max(2200).optional() }).strict().safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtres invalides.' });
    const query = parsed.data;
    const where: string[] = ['c.active=true'];
    const values: unknown[] = [];

    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      where.push(`(c.name ilike $${values.length} or c.slug ilike $${values.length} or coalesce(c.official_name,'') ilike $${values.length})`);
    }
    if (query.season) {
      values.push(query.season);
      where.push(`c.season = $${values.length}`);
    }

    const result = await pool.query(
      `${publicSelectSql} where ${where.join(' and ')} group by c.id order by c.name`,
      values
    );
    return result.rows;
  });

  app.get('/api/v1/championships/:id', async (request, reply) => {
    const parsed = uuidParam('id', request.params); if (!parsed) return reply.code(400).send({ message: 'Identifiant invalide.' });
    const result = await pool.query(`${publicSelectSql} where c.id=$1 and c.active=true group by c.id`, [parsed.id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Championnat introuvable.' });
    return result.rows[0];
  });

  app.get('/api/v1/admin/championships', async () => (
    await pool.query(`${adminSelectSql} group by c.id order by c.name`)
  ).rows);

  app.get('/api/v1/admin/championships/:id', async (request, reply) => {
    const parsed = uuidParam('id', request.params); if (!parsed) return reply.code(400).send({ message: 'Identifiant invalide.' });
    const result = await pool.query(`${adminSelectSql} where c.id=$1 group by c.id`, [parsed.id]);
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
      const created = await withTransaction(async (client) => {
        const result = await client.query(`insert into championships(
          id,slug,name,short_name,official_name,category,season,active,sync_enabled,
          provider_key,external_id,logo_url,description
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [id, ...dbValues(parsed.data)]
        );
        await writeAdminAudit(client, { request, resourceType: 'championship', resourceId: id, oldValue: null, newValue: result.rows[0] });
        return result.rows[0];
      });
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      throw error;
    }
  });

  app.patch('/api/v1/championships/:id', async (request, reply) => {
    const idParam = uuidParam('id', request.params); if (!idParam) return reply.code(400).send({ message: 'Identifiant invalide.' });
    const { id } = idParam;
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Données invalides.', issues: parsed.error.issues });
    try {
      const updated = await withTransaction(async (client) => {
        const current = await client.query('select * from championships where id=$1 for update', [id]);
        if (!current.rowCount) return null;
        const merged = championshipBody.parse({ ...current.rows[0], ...parsed.data });
        if (merged.sync_enabled && !cleanNullable(merged.provider_key)) throw new ChampionshipValidationError('Un provider doit être sélectionné lorsque la synchronisation est activée.');
        const result = await client.query(`update championships set
          slug=$2,name=$3,short_name=$4,official_name=$5,category=$6,season=$7,
          active=$8,sync_enabled=$9,provider_key=$10,external_id=$11,logo_url=$12,
          description=$13,updated_at=now()
        where id=$1 returning *`,
        [id, ...dbValues(merged)]
        );
        await writeAdminAudit(client, { request, resourceType: 'championship', resourceId: id, oldValue: current.rows[0], newValue: result.rows[0] });
        return result.rows[0];
      });
      if (!updated) return reply.code(404).send({ message: 'Championnat introuvable.' });
      markAtomicallyAudited(request);
      return updated;
    } catch (error: unknown) {
      if (error instanceof ChampionshipValidationError) return reply.code(400).send({ message: error.message });
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: 'Ce slug existe déjà.' });
      throw error;
    }
  });

  app.delete('/api/v1/championships/:id', async (request, reply) => {
    const parsed = uuidParam('id', request.params); if (!parsed) return reply.code(400).send({ message: 'Identifiant invalide.' });
    try {
      const deleted = await withTransaction(async (client) => {
        const current = await client.query('select * from championships where id=$1 for update', [parsed.id]);
        if (!current.rowCount) return null;
        const linked = await client.query('select count(*)::int as count from events where championship_id=$1', [parsed.id]);
        if (linked.rows[0].count > 0) throw new ChampionshipConflictError(`Suppression impossible : ${linked.rows[0].count} événement(s) sont encore liés à ce championnat.`);
        await client.query('delete from championships where id=$1', [parsed.id]);
        await writeAdminAudit(client, { request, resourceType: 'championship', resourceId: parsed.id, oldValue: current.rows[0], newValue: null });
        return true;
      });
      if (!deleted) return reply.code(404).send({ message: 'Championnat introuvable.' });
      markAtomicallyAudited(request);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ChampionshipConflictError) return reply.code(409).send({ message: error.message });
      throw error;
    }
  });
}

class ChampionshipValidationError extends Error {}
class ChampionshipConflictError extends Error {}
