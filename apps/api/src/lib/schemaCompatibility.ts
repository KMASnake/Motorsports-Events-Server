export const APPLICATION_SCHEMA_MIGRATIONS = [
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
  '0011_persistent_sync_scheduler',
  '0012_scheduler_audit_fixes',
  '0013_provider_quota_cadence',
  '0014_lot55_audit_fixes',
  '0015_lot55_final_audit_fixes',
  '0016_lot56_durable_acquisition',
  '0017_lot56_durable_parent_reference',
  '0018_lot56_traversal_fencing',
  '0019_lot56_durable_orchestration',
  '0020_lot56_current_refresh_scope',
  '0021_lot56_current_global_finalization_queue',
  '0022_lot56_temporality_finalization',
  '0023_lot56_source_protection',
  '0024_lot57pa_normalized_persistence',
  '0025_lot57pc_publication_state',
  '0026_legacy_provider_uuid_repair',
  '0027_lot57pc_public_resource_history',
  '0028_lot57pe_client_security',
  '0029_lot57pe_canonical_championship_entitlements',
  '0030_lot57pf_normalization_mapping_persistence',
  '0031_real_circuit_reference_data'
] as const;

export const APPLICATION_SCHEMA_HEAD = APPLICATION_SCHEMA_MIGRATIONS.at(-1)!;

export type SchemaCompatibilityCode =
  | 'compatible'
  | 'migration_metadata_missing'
  | 'schema_too_old'
  | 'schema_unknown'
  | 'schema_inconsistent';

export type SchemaCompatibility = {
  compatible: boolean;
  code: SchemaCompatibilityCode;
  expectedHead: string;
  actualHead?: string;
};

export function classifySchemaVersions(versions: readonly string[] | null): SchemaCompatibility {
  if (versions === null) {
    return { compatible: false, code: 'migration_metadata_missing', expectedHead: APPLICATION_SCHEMA_HEAD };
  }
  const expected = [...APPLICATION_SCHEMA_MIGRATIONS];
  const actual = [...versions].sort();
  const unknown = actual.find(version => !expected.includes(version as typeof APPLICATION_SCHEMA_MIGRATIONS[number]));
  if (unknown) {
    return { compatible: false, code: 'schema_unknown', expectedHead: APPLICATION_SCHEMA_HEAD, actualHead: actual.at(-1) };
  }
  const exactPrefix = actual.every((version, index) => version === expected[index]);
  if (!exactPrefix) {
    return { compatible: false, code: 'schema_inconsistent', expectedHead: APPLICATION_SCHEMA_HEAD, actualHead: actual.at(-1) };
  }
  if (actual.length < expected.length) {
    return { compatible: false, code: 'schema_too_old', expectedHead: APPLICATION_SCHEMA_HEAD, actualHead: actual.at(-1) };
  }
  if (actual.length !== expected.length) {
    return { compatible: false, code: 'schema_inconsistent', expectedHead: APPLICATION_SCHEMA_HEAD, actualHead: actual.at(-1) };
  }
  return { compatible: true, code: 'compatible', expectedHead: APPLICATION_SCHEMA_HEAD, actualHead: APPLICATION_SCHEMA_HEAD };
}

export function schemaCompatibilityMessage(result: SchemaCompatibility): string {
  switch (result.code) {
    case 'compatible': return 'Database schema is compatible.';
    case 'migration_metadata_missing': return 'Database migration metadata is missing.';
    case 'schema_too_old': return `Database schema is too old; expected ${result.expectedHead}.`;
    case 'schema_unknown': return `Database schema is unknown; expected ${result.expectedHead}.`;
    case 'schema_inconsistent': return `Database migration state is inconsistent; expected ${result.expectedHead}.`;
  }
}
