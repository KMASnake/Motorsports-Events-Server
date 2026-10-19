import pg from 'pg';
import type { PoolClient } from 'pg';
import {
  classifySchemaVersions,
  schemaCompatibilityMessage,
  type SchemaCompatibilityCode
} from './schemaCompatibility.js';

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

export type DatabaseReadiness = {
  ready: boolean;
  code: SchemaCompatibilityCode | 'database_unreachable' | 'schema_check_failed';
};

export async function databaseReadiness(): Promise<DatabaseReadiness> {
  try {
    await pool.query('select 1');
  } catch {
    return { ready: false, code: 'database_unreachable' };
  }
  try {
    const metadata = await pool.query<{ migration_table: string | null }>(
      "select to_regclass('public.schema_migrations')::text as migration_table"
    );
    if (!metadata.rows[0]?.migration_table) {
      return { ready: false, code: 'migration_metadata_missing' };
    }
    const versions = await pool.query<{ version: string }>('select version from schema_migrations order by version');
    const compatibility = classifySchemaVersions(versions.rows.map(row => row.version));
    return { ready: compatibility.compatible, code: compatibility.code };
  } catch {
    return { ready: false, code: 'schema_check_failed' };
  }
}

export async function verifyApplicationSchema(): Promise<void> {
  const readiness = await databaseReadiness();
  if (!readiness.ready) {
    if (readiness.code === 'database_unreachable') throw new Error('Database is unreachable.');
    if (readiness.code === 'schema_check_failed') throw new Error('Database schema compatibility check failed.');
    const compatibility = classifySchemaVersions(readiness.code === 'migration_metadata_missing' ? null : []);
    throw new Error(schemaCompatibilityMessage({ ...compatibility, code: readiness.code }));
  }
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
    sync_restore_column: string | null;
    quota_runtime_table:string|null;
    api_clients_table:string|null;
    disciplines_table:string|null;
    discipline_families_table:string|null;
    championship_discipline_column:string|null;
    championship_seasons_table:string|null;
    meeting_championship_season_column:string|null;
    provider_discovery_observations_table:string|null;
    championship_discovery_candidates_table:string|null;
    championship_source_links_table:string|null;
    championship_season_source_links_table:string|null;
    championship_discovery_decisions_table:string|null;
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
      (select column_name from information_schema.columns
        where table_schema='public' and table_name='provider_championships'
          and column_name='sync_state_before_championship_disable') as sync_restore_column,
      to_regclass('public.provider_quota_runtime')::text as quota_runtime_table,
      to_regclass('public.api_clients')::text as api_clients_table,
      to_regclass('public.disciplines')::text as disciplines_table,
      to_regclass('public.discipline_families')::text as discipline_families_table,
      (select column_name from information_schema.columns
        where table_schema='public' and table_name='championships' and column_name='discipline_key') as championship_discipline_column,
      to_regclass('public.championship_seasons')::text as championship_seasons_table,
      (select column_name from information_schema.columns
        where table_schema='public' and table_name='meetings' and column_name='championship_season_id') as meeting_championship_season_column,
      to_regclass('public.provider_discovery_observations')::text as provider_discovery_observations_table,
      to_regclass('public.championship_discovery_candidates')::text as championship_discovery_candidates_table,
      to_regclass('public.championship_source_links')::text as championship_source_links_table,
      to_regclass('public.championship_season_source_links')::text as championship_season_source_links_table,
      to_regclass('public.championship_discovery_decisions')::text as championship_discovery_decisions_table
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
    !schema.sync_restore_column ||
    !schema.quota_runtime_table ||
    !schema.disciplines_table ||
    !schema.discipline_families_table ||
    !schema.championship_discipline_column ||
    !schema.championship_seasons_table ||
    !schema.meeting_championship_season_column ||
    !schema.provider_discovery_observations_table ||
    !schema.championship_discovery_candidates_table ||
    !schema.championship_source_links_table ||
    !schema.championship_season_source_links_table ||
    !schema.championship_discovery_decisions_table ||
    (process.env.PREVIEW_API_ENABLED === 'true' && !schema.api_clients_table)
  ) {
    throw new Error('Database schema is incomplete. Run the versioned migrations before starting the API.');
  }
}
