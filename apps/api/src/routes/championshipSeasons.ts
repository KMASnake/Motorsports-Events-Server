import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { markAtomicallyAudited } from '../lib/adminAudit.js';
import { uuid } from '../lib/routeParams.js';
import {
  ChampionshipSeasonNotFoundError,
  ChampionshipSeasonService,
  type ChampionshipSeasonInput
} from '../championshipSeasons/championshipSeasonService.js';

const championshipId = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/);
const seasonKey = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);
const year = z.number().int().min(1950).max(2200);
const canonicalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date invalide.');
const nullableDate = z.union([canonicalDate, z.null()]);
const nullableYear = z.union([year, z.null()]);

const championshipSeasonFields = z.object({
  key: seasonKey,
  label: z.string().trim().min(1).max(200),
  start_year: nullableYear,
  end_year: nullableYear,
  starts_on: nullableDate,
  ends_on: nullableDate
}).strict();
function validateRanges(value: ChampionshipSeasonInput, context: z.RefinementCtx) {
  if (value.start_year !== null && value.end_year !== null && value.end_year < value.start_year) {
    context.addIssue({ code: 'custom', path: ['end_year'], message: 'end_year doit être supérieur ou égal à start_year.' });
  }
  if (value.starts_on !== null && value.ends_on !== null && value.ends_on < value.starts_on) {
    context.addIssue({ code: 'custom', path: ['ends_on'], message: 'ends_on doit être postérieur ou égal à starts_on.' });
  }
}
export const championshipSeasonBody = z.object({
  key: seasonKey,
  label: z.string().trim().min(1).max(200),
  start_year: nullableYear.default(null),
  end_year: nullableYear.default(null),
  starts_on: nullableDate.default(null),
  ends_on: nullableDate.default(null)
}).strict().superRefine(validateRanges);

const patchBody = championshipSeasonFields.omit({ key: true }).partial().strict();
export interface ChampionshipSeasonRouteOptions { service?: ChampionshipSeasonService }

function databaseError(reply: { code(status: number): { send(value: unknown): unknown } }, error: unknown) {
  const code = (error as { code?: string }).code;
  if (error instanceof ChampionshipSeasonNotFoundError) return reply.code(404).send({ message: error.message });
  if (code === '23505') return reply.code(409).send({ message: 'Cette clé de saison existe déjà pour ce championnat.' });
  if (code === '23503') return reply.code(400).send({ message: 'Référence ChampionshipSeason invalide.' });
  throw error;
}

export async function championshipSeasonRoutes(app: FastifyInstance, options: ChampionshipSeasonRouteOptions = {}) {
  const service = options.service ?? new ChampionshipSeasonService();

  app.get('/api/v1/admin/championships/:championshipId/seasons', async (request, reply) => {
    const params = z.object({ championshipId }).strict().safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Identifiant de championnat invalide.' });
    try { return await service.list(params.data.championshipId); } catch (error) { return databaseError(reply, error); }
  });

  app.post('/api/v1/admin/championships/:championshipId/seasons', async (request, reply) => {
    const params = z.object({ championshipId }).strict().safeParse(request.params);
    const body = championshipSeasonBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: 'Saison de championnat invalide.', issues: body.success ? [] : body.error.issues });
    try {
      const created = await service.create(params.data.championshipId, body.data, request);
      markAtomicallyAudited(request);
      return reply.code(201).send(created);
    } catch (error) { return databaseError(reply, error); }
  });

  app.get('/api/v1/admin/championship-seasons/:id', async (request, reply) => {
    const params = z.object({ id: uuid }).strict().safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'Identifiant de saison invalide.' });
    const found = await service.get(params.data.id);
    return found ?? reply.code(404).send({ message: 'Saison de championnat introuvable.' });
  });

  app.patch('/api/v1/admin/championship-seasons/:id', async (request, reply) => {
    const params = z.object({ id: uuid }).strict().safeParse(request.params);
    const body = patchBody.safeParse(request.body);
    if (!params.success || !body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ message: 'Saison de championnat invalide.' });
    try {
      const updated = await service.update(
        params.data.id,
        body.data,
        value => championshipSeasonBody.parse(value) as ChampionshipSeasonInput,
        request
      );
      if (!updated) return reply.code(404).send({ message: 'Saison de championnat introuvable.' });
      markAtomicallyAudited(request);
      return updated;
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ message: 'Saison de championnat invalide.', issues: error.issues });
      return databaseError(reply, error);
    }
  });
}
