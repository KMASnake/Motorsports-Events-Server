import { z } from 'zod';

const nullableDescription = z.union([z.string().trim().max(2000), z.null()]).optional();
const instant = z.string().datetime({ offset: true });
export const sessionStatus = z.enum(['draft', 'scheduled', 'completed', 'cancelled', 'postponed']);

const sessionBody = z.object({
  title: z.string().trim().min(1).max(160),
  starts_at: instant,
  ends_at: z.union([instant, z.null()]).optional(),
  status: sessionStatus,
  published: z.boolean(),
  description: nullableDescription
}).strict();

export const createSessionBody = sessionBody.extend({
  status: sessionStatus.default('scheduled'),
  published: z.boolean().default(true)
}).strict();

export const updateSessionBody = sessionBody.partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification demandée.');

export const sessionListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  status: sessionStatus.optional(),
  published: z.enum(['true', 'false']).optional(),
  from: instant.optional(),
  to: instant.optional(),
  sort: z.enum(['starts_at', 'title', 'status', 'updated_at']).default('starts_at'),
  direction: z.enum(['asc', 'desc']).default('asc')
}).strict();

export const publicSessionQuery = z.object({
  status: sessionStatus.exclude(['draft']).optional(),
  from: instant.optional(),
  to: instant.optional()
}).strict();

export type CreateSessionBody = z.infer<typeof createSessionBody>;
export type UpdateSessionBody = z.infer<typeof updateSessionBody>;

export function normalizedSessionDates<T extends { starts_at?: string; ends_at?: string | null }>(value: T): T {
  return {
    ...value,
    ...(value.starts_at === undefined ? {} : { starts_at: new Date(value.starts_at).toISOString() }),
    ...(value.ends_at === undefined ? {} : { ends_at: value.ends_at === null ? null : new Date(value.ends_at).toISOString() })
  };
}

export function validateSessionPeriod(startsAt: string, endsAt?: string | null): string | null {
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    return 'La date de fin doit être postérieure ou égale à la date de début.';
  }
  return null;
}
