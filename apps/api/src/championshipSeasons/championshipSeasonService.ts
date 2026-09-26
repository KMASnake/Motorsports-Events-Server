import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { pool, withTransaction } from '../lib/db.js';
import { writeAdminAudit } from '../lib/adminAudit.js';

export type ChampionshipSeasonInput = {
  key: string;
  label: string;
  start_year: number | null;
  end_year: number | null;
  starts_on: string | null;
  ends_on: string | null;
};

export class ChampionshipSeasonNotFoundError extends Error {}

export class ChampionshipSeasonService {
  async list(championshipId: string) {
    const championship = await pool.query('select id from championships where id=$1', [championshipId]);
    if (!championship.rowCount) throw new ChampionshipSeasonNotFoundError('Championnat introuvable.');
    return (await pool.query(
      `select * from championship_seasons where championship_id=$1
       order by starts_on nulls last,start_year nulls last,key,id`,
      [championshipId]
    )).rows;
  }

  async get(id: string) {
    return (await pool.query('select * from championship_seasons where id=$1', [id])).rows[0] ?? null;
  }

  async create(championshipId: string, input: ChampionshipSeasonInput, request: FastifyRequest) {
    return withTransaction(async client => {
      const championship = await client.query('select id from championships where id=$1 for key share', [championshipId]);
      if (!championship.rowCount) throw new ChampionshipSeasonNotFoundError('Championnat introuvable.');
      const id = randomUUID();
      const created = (await client.query(
        `insert into championship_seasons(
          id,championship_id,key,label,start_year,end_year,starts_on,ends_on
        ) values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [id, championshipId, input.key, input.label, input.start_year, input.end_year, input.starts_on, input.ends_on]
      )).rows[0];
      await writeAdminAudit(client, { request, resourceType: 'championship-season', resourceId: id, oldValue: null, newValue: created });
      return created;
    });
  }

  async update(
    id: string,
    patch: Partial<Omit<ChampionshipSeasonInput, 'key'>>,
    validate: (value: unknown) => ChampionshipSeasonInput,
    request: FastifyRequest
  ) {
    return withTransaction(async client => {
      const current = (await client.query('select * from championship_seasons where id=$1 for update', [id])).rows[0];
      if (!current) return null;
      const input = validate({
        key: current.key,
        label: current.label,
        start_year: current.start_year,
        end_year: current.end_year,
        starts_on: current.starts_on,
        ends_on: current.ends_on,
        ...patch
      });
      const updated = (await client.query(
        `update championship_seasons set
          label=$2,start_year=$3,end_year=$4,starts_on=$5,ends_on=$6,updated_at=now()
         where id=$1 returning *`,
        [id, input.label, input.start_year, input.end_year, input.starts_on, input.ends_on]
      )).rows[0];
      await writeAdminAudit(client, { request, resourceType: 'championship-season', resourceId: id, oldValue: current, newValue: updated });
      return updated;
    });
  }
}
