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
  const result = await pool.query<{
    correction_table: string | null;
    session_types_table: string | null;
    sessions_table: string | null;
    session_corrections_table: string | null;
    session_title_column: string | null;
    admin_accounts_table: string | null;
    admin_login_guard_table: string | null;
    admin_sessions_table: string | null;
    applied_migrations: number;
  }>(`
    select
      to_regclass('public.event_corrections')::text as correction_table,
      to_regclass('public.session_types')::text as session_types_table,
      to_regclass('public.sessions')::text as sessions_table,
      to_regclass('public.session_corrections')::text as session_corrections_table,
      (select column_name from information_schema.columns
        where table_schema='public' and table_name='events' and column_name='session_title') as session_title_column,
      to_regclass('public.admin_accounts')::text as admin_accounts_table,
      to_regclass('public.admin_login_guard')::text as admin_login_guard_table,
      to_regclass('public.admin_sessions')::text as admin_sessions_table,
      (select count(*)::int from schema_migrations
       where version in (
         '0001_event_corrections',
         '0002_utc_storage',
         '0003_admin_audit_and_provider_identity',
         '0004_sessions',
         '0005_event_session_title',
         '0006_admin_console_authentication'
       )) as applied_migrations
  `);

  const schema = result.rows[0];
  if (
    !schema?.correction_table ||
    !schema.session_types_table ||
    !schema.sessions_table ||
    !schema.session_corrections_table ||
    !schema.session_title_column ||
    !schema.admin_accounts_table ||
    !schema.admin_login_guard_table ||
    !schema.admin_sessions_table ||
    schema.applied_migrations !== 6
  ) {
    throw new Error('Database schema is incomplete. Run the versioned migrations before starting the API.');
  }
}
