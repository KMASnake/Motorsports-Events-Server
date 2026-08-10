import { z } from 'zod';
import { sessionStatus } from './sessionContracts.js';

const title = z.string().trim().min(1).max(160);
const instant = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString());
const nullableDescription = z.union([z.string().trim().max(2000), z.null()]);

export const sessionCorrectionValue = z.discriminatedUnion('field_name', [
  z.object({ field_name: z.literal('title'), override_value: title }).strict(),
  z.object({ field_name: z.literal('starts_at'), override_value: instant }).strict(),
  z.object({ field_name: z.literal('ends_at'), override_value: z.union([instant, z.null()]) }).strict(),
  z.object({ field_name: z.literal('status'), override_value: sessionStatus }).strict(),
  z.object({ field_name: z.literal('published'), override_value: z.boolean() }).strict(),
  z.object({ field_name: z.literal('description'), override_value: nullableDescription }).strict()
]);

export const providerSessionPatch = z.object({
  title: title.optional(),
  starts_at: instant.optional(),
  ends_at: z.union([instant, z.null()]).optional(),
  status: sessionStatus.optional(),
  published: z.boolean().optional(),
  description: nullableDescription.optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Aucune valeur fournisseur à synchroniser.');

export type SessionCorrectionInput = z.infer<typeof sessionCorrectionValue>;
export type ProviderSessionPatch = z.infer<typeof providerSessionPatch>;

export function parseSessionCorrectionValue(value: unknown): SessionCorrectionInput {
  return sessionCorrectionValue.parse(value);
}
