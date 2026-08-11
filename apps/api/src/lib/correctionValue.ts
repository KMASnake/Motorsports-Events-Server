import { z } from 'zod';

const text = z.string().trim().min(1).max(2000);
const nullableText = z.union([z.string().trim().max(2000), z.null()]);
const reference = z.string().trim().min(1).max(160);
const instant = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString());
const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const status = z.enum(['draft', 'scheduled', 'completed', 'cancelled', 'postponed']);

export const correctionOverrideBody = z.discriminatedUnion('field_name', [
  z.object({ field_name: z.literal('championship_id'), override_value: reference }).strict(),
  z.object({ field_name: z.literal('circuit_id'), override_value: z.union([reference, z.null()]) }).strict(),
  z.object({ field_name: z.literal('name'), override_value: text.max(160) }).strict(),
  z.object({ field_name: z.literal('slug'), override_value: slug }).strict(),
  z.object({ field_name: z.literal('category'), override_value: nullableText }).strict(),
  z.object({ field_name: z.literal('starts_at'), override_value: instant }).strict(),
  z.object({ field_name: z.literal('ends_at'), override_value: z.union([instant, z.null()]) }).strict(),
  z.object({ field_name: z.literal('status'), override_value: status }).strict(),
  z.object({ field_name: z.literal('published'), override_value: z.boolean() }).strict(),
  z.object({ field_name: z.literal('description'), override_value: nullableText }).strict(),
  z.object({ field_name: z.literal('session_title'), override_value: z.union([text.max(160), z.null()]) }).strict()
]);

export type CorrectionOverrideBody = z.infer<typeof correctionOverrideBody>;

export function parseCorrectionOverride(value: unknown): CorrectionOverrideBody {
  return correctionOverrideBody.parse(value);
}

export function correctionReference(
  body: CorrectionOverrideBody
): { table: 'championships' | 'circuits'; id: string } | null {
  if (body.field_name === 'championship_id') return { table: 'championships', id: body.override_value };
  if (body.field_name === 'circuit_id' && body.override_value !== null) return { table: 'circuits', id: body.override_value };
  return null;
}
