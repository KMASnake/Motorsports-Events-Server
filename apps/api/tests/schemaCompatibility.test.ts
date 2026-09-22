import { describe, expect, it } from 'vitest';
import {
  APPLICATION_SCHEMA_HEAD,
  APPLICATION_SCHEMA_MIGRATIONS,
  classifySchemaVersions,
  schemaCompatibilityMessage
} from '../src/lib/schemaCompatibility.js';

describe('application schema compatibility', () => {
  it('accepts only the exact current migration chain', () => {
    const result = classifySchemaVersions(APPLICATION_SCHEMA_MIGRATIONS);
    expect(APPLICATION_SCHEMA_HEAD).toBe('0031_real_circuit_reference_data');
    expect(result).toMatchObject({ compatible: true, code: 'compatible', actualHead: APPLICATION_SCHEMA_HEAD });
  });

  it('rejects an older schema explicitly', () => {
    const result = classifySchemaVersions(APPLICATION_SCHEMA_MIGRATIONS.slice(0, -1));
    expect(result).toMatchObject({ compatible: false, code: 'schema_too_old', actualHead: '0030_lot57pf_normalization_mapping_persistence' });
  });

  it('rejects unknown, missing and inconsistent migration state', () => {
    expect(classifySchemaVersions([...APPLICATION_SCHEMA_MIGRATIONS, '9999_unknown'])).toMatchObject({
      compatible: false, code: 'schema_unknown'
    });
    expect(classifySchemaVersions(null)).toMatchObject({
      compatible: false, code: 'migration_metadata_missing'
    });
    expect(classifySchemaVersions(APPLICATION_SCHEMA_MIGRATIONS.filter(version => version !== '0030_lot57pf_normalization_mapping_persistence'))).toMatchObject({
      compatible: false, code: 'schema_inconsistent'
    });
    expect(classifySchemaVersions([])).toMatchObject({
      compatible: false, code: 'schema_too_old', actualHead: undefined
    });
    expect(classifySchemaVersions([...APPLICATION_SCHEMA_MIGRATIONS, '0031_real_circuit_reference_data'])).toMatchObject({
      compatible: false, code: 'schema_inconsistent'
    });
  });

  it('uses bounded errors without connection strings or secrets', () => {
    for (const versions of [null, APPLICATION_SCHEMA_MIGRATIONS.slice(0, -1), ['9999_unknown']]) {
      const message = schemaCompatibilityMessage(classifySchemaVersions(versions));
      expect(message).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(message).not.toMatch(/password|secret|DATABASE_URL/i);
      expect(message.length).toBeLessThan(160);
    }
  });
});
