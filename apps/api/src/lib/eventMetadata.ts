import type { PoolClient } from 'pg';

export function slugifyEventName(value: string): string {
  const slug = value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'evenement';
}

export async function uniqueEventSlug(
  client: PoolClient,
  name: string,
  excludeEventId?: string
): Promise<string> {
  const base = slugifyEventName(name);
  const result = await client.query<{ slug: string }>(
    `select slug from events
      where (slug=$1 or slug like $1 || '-%')
        and ($2::text is null or id<>$2)`,
    [base, excludeEventId ?? null]
  );
  const occupied = new Set(result.rows.map((row) => row.slug));
  if (!occupied.has(base)) return base;
  let suffix = 2;
  while (occupied.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function deriveEventTimezone(
  client: PoolClient,
  circuitId: string | null | undefined,
  fallback = 'UTC'
): Promise<string> {
  if (!circuitId) return fallback;
  const result = await client.query<{ timezone: string | null }>(
    'select timezone from circuits where id=$1',
    [circuitId]
  );
  if (!result.rowCount) throw new EventMetadataError('Le circuit sélectionné n’existe pas.');
  const timezone = result.rows[0].timezone?.trim();
  return timezone || fallback;
}

export class EventMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventMetadataError';
  }
}
