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
    provider_instances_table: string | null;
    provider_secrets_table: string | null;
    provider_quota_policies_table: string | null;
    provider_quota_state_table: string | null;
    provider_championships_table: string | null;
    provider_source_configs_table: string | null;
    provider_discoveries_table: string | null;
    provider_discovery_runs_table: string | null;
    sync_streams_table: string | null;
    sync_runs_table: string | null;
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
      to_regclass('public.provider_instances')::text as provider_instances_table,
      to_regclass('public.provider_secrets')::text as provider_secrets_table,
      to_regclass('public.provider_quota_policies')::text as provider_quota_policies_table,
      to_regclass('public.provider_quota_state')::text as provider_quota_state_table,
      to_regclass('public.provider_championships')::text as provider_championships_table,
      to_regclass('public.provider_championship_source_configs')::text as provider_source_configs_table,
      to_regclass('public.provider_discovered_championships')::text as provider_discoveries_table,
      to_regclass('public.provider_discovery_runs')::text as provider_discovery_runs_table,
      to_regclass('public.sync_streams')::text as sync_streams_table,
      to_regclass('public.sync_runs')::text as sync_runs_table,
      (select count(*)::int from schema_migrations
       where version in (
         '0001_event_corrections',
         '0002_utc_storage',
         '0003_admin_audit_and_provider_identity',
         '0004_sessions',
         '0005_event_session_title',
         '0006_admin_console_authentication',
         '0007_provider_instances',
         '0008_provider_championship_sources',
         '0009_provider_discovery',
         '0010_provider_discovery_completeness',
         '0011_persistent_sync_scheduler'
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
    !schema.provider_instances_table ||
    !schema.provider_secrets_table ||
    !schema.provider_quota_policies_table ||
    !schema.provider_quota_state_table ||
    !schema.provider_championships_table ||
    !schema.provider_source_configs_table ||
    !schema.provider_discoveries_table ||
    !schema.provider_discovery_runs_table ||
    !schema.sync_streams_table ||
    !schema.sync_runs_table ||
    schema.applied_migrations !== 11
  ) {
    throw new Error('Database schema is incomplete. Run the versioned migrations before starting the API.');
  }
}
