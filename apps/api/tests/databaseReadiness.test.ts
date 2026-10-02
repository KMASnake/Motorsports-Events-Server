import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPLICATION_SCHEMA_MIGRATIONS } from '../src/lib/schemaCompatibility.js';
import { databaseReadiness, pool } from '../src/lib/db.js';

describe('database readiness probe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('classifies an inaccessible database without exposing its error', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('postgresql://user:secret@private/db'));
    await expect(databaseReadiness()).resolves.toEqual({ ready: false, code: 'database_unreachable' });
  });

  it('refuses missing migration metadata', async () => {
    vi.spyOn(pool, 'query')
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ migration_table: null }] } as never);
    await expect(databaseReadiness()).resolves.toEqual({ ready: false, code: 'migration_metadata_missing' });
  });

  it('accepts the exact schema and rejects an old schema', async () => {
    const query = vi.spyOn(pool, 'query');
    query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ migration_table: 'schema_migrations' }] } as never)
      .mockResolvedValueOnce({ rows: APPLICATION_SCHEMA_MIGRATIONS.map(version => ({ version })) } as never);
    await expect(databaseReadiness()).resolves.toEqual({ ready: true, code: 'compatible' });

    query.mockReset()
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ migration_table: 'schema_migrations' }] } as never)
      .mockResolvedValueOnce({ rows: APPLICATION_SCHEMA_MIGRATIONS.slice(0, -1).map(version => ({ version })) } as never);
    await expect(databaseReadiness()).resolves.toEqual({ ready: false, code: 'schema_too_old' });
  });
});
