import pg from 'pg';
import type { PoolClient } from 'pg';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}

export async function verifyApplicationSchema(): Promise<void> {
  const result = await pool.query<{ correction_table: string | null; applied_migrations: number }>(`
    select
      to_regclass('public.event_corrections')::text as correction_table,
      (select count(*)::int from schema_migrations
       where version in ('0001_event_corrections', '0002_utc_storage', '0003_admin_audit_and_provider_identity')) as applied_migrations
  `);

  const schema = result.rows[0];
  if (!schema?.correction_table || schema.applied_migrations !== 3) {
    throw new Error('Database schema is incomplete. Run the versioned migrations before starting the API.');
  }
}
