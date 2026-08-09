import { z } from 'zod';
import { correctableEventFields } from './eventCorrections.js';

const page = z.coerce.number().int().min(1).optional();
const pageSize = z.coerce.number().int().min(1).max(100).default(25);
const instant = z.string().datetime({ offset: true });
const eventStatus = z.enum(['draft', 'scheduled', 'completed', 'cancelled', 'postponed']);

export const adminEventQuery = z.object({
  search: z.string().trim().max(160).optional(), championship_id: z.string().trim().min(1).optional(),
  status: eventStatus.optional(), published: z.enum(['true', 'false']).optional(), from: instant.optional(), to: instant.optional(),
  page, page_size: pageSize, sort: z.enum(['starts_at', 'name', 'championship', 'status', 'updated_at']).default('starts_at'),
  direction: z.enum(['asc', 'desc']).default('asc')
}).strict();
export const publicEventQuery = z.object({ championship_id: z.string().trim().min(1).optional(), status: eventStatus.optional(), from: instant.optional(), to: instant.optional() }).strict();
export const correctionQuery = z.object({
  status: z.enum(['active', 'conflict', 'resolved', 'ignored']).optional(), conflict: z.enum(['true', 'false']).optional(),
  event_id: z.string().trim().min(1).optional(), field: z.enum(correctableEventFields).optional(),
  provider: z.string().trim().min(1).optional(), championship_id: z.string().trim().min(1).optional(),
  page, page_size: pageSize, sort: z.enum(['updated_at', 'event_name', 'field_name', 'status']).default('updated_at'),
  direction: z.enum(['asc', 'desc']).default('desc')
}).strict();
export const auditQuery = z.object({ page: page.default(1), page_size: pageSize, resource_type: z.string().trim().min(1).optional() }).strict();

export type Paginated<T> = { items: T[]; pagination: { page: number; page_size: number; total: number; pages: number } };
export function paginated<T>(items: T[], total: number, pageNumber: number, pageLimit: number): Paginated<T> {
  return { items, pagination: { page: pageNumber, page_size: pageLimit, total, pages: Math.max(1, Math.ceil(total / pageLimit)) } };
}
