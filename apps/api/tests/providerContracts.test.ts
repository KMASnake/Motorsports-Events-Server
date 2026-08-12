import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertChampionshipSourceFields,
  assertProviderAdapterContract,
  type FetchWorkUnitResult,
  type JsonObject,
  type ProviderAdapter
} from '../src/providers/contracts.js';
import { ProviderAdapterRegistry } from '../src/providers/registry.js';

type Cursor = JsonObject & { readonly strategy: string; readonly position: number; readonly token: string };

function adapter(key: string, strategy: string): ProviderAdapter<JsonObject, JsonObject, Cursor, JsonObject> {
  return {
    key,
    capabilities: {
      supportsChampionshipDiscovery: false,
      supportsSeasonDiscovery: false,
      supportsQuotaHeaders: false,
      supportsConnectionTest: false
    },
    providerConfigVersion: 1,
    sourceConfigVersion: 1,
    cursorVersion: 1,
    providerForm: () => [{ key: 'base_url', label: 'URL de base', type: 'url', required: true }],
    championshipForm: () => [
      { key: 'strategy', label: 'Stratégie', type: 'select', required: true },
      { key: 'external_id', label: 'Identifiant externe', type: 'text', required: true }
    ],
    validateProviderConfig(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider config.');
      return value as JsonObject;
    },
    validateSourceConfig(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source config.');
      const config = value as JsonObject;
      if (typeof config.strategy !== 'string' || typeof config.external_id !== 'string') {
        throw new Error('Invalid championship source config.');
      }
      return config;
    },
    initialCursor: () => ({ strategy, position: 0, token: '' }),
    validateCursor(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid cursor.');
      const cursor = value as Partial<Cursor>;
      if (
        typeof cursor.strategy !== 'string' ||
        typeof cursor.position !== 'number' ||
        typeof cursor.token !== 'string'
      ) throw new Error('Invalid cursor.');
      return cursor as Cursor;
    },
    serializeCursor: (cursor) => cursor,
    restoreCursor(value, version) {
      if (version !== 1) throw new Error('Unsupported cursor version.');
      return this.validateCursor(value);
    },
    async fetchWorkUnit(input): Promise<FetchWorkUnitResult<JsonObject, Cursor>> {
      return {
        status: 'progress',
        items: [],
        nextCursor: { ...input.cursor, position: input.cursor.position + 1 },
        requestCount: 1
      };
    },
    normalize: () => ({ accepted: [], rejected: [] }),
    async confirmEmptySeason(evidence) {
      return {
        confirmedEmpty: evidence.completedTraversal && evidence.receivedItems === 0,
        reason: 'Fake adapter evidence.'
      };
    }
  };
}

describe('Provider adapter foundations', () => {
  it.each([
    ['page', { strategy: 'page', position: 4, token: '' }],
    ['token', { strategy: 'token', position: 0, token: 'next-token' }],
    ['compound', { strategy: 'compound', position: 7, token: 'season:2026' }]
  ])('validates and restores a %s cursor', (_name, cursor) => {
    const fake = adapter(`fake-${_name}`, _name);
    const restored = fake.restoreCursor(fake.serializeCursor(cursor), 1);
    expect(restored).toEqual(cursor);
  });

  it('keeps two championship source configurations distinct for one provider', () => {
    const fake = adapter('same-provider', 'page');
    const first = fake.validateSourceConfig({ strategy: 'page', external_id: 'formula-1' }, { providerConfig: {} });
    const second = fake.validateSourceConfig({ strategy: 'compound', external_id: 'rally-world' }, { providerConfig: {} });
    expect(first).not.toEqual(second);
    expect(first.external_id).toBe('formula-1');
    expect(second.strategy).toBe('compound');
  });

  it('registers independent adapters including a third strategy', () => {
    const registry = new ProviderAdapterRegistry();
    registry.register(adapter('page-provider', 'page'));
    registry.register(adapter('token-provider', 'token'));
    registry.register(adapter('synthetic-provider', 'compound'));
    expect(registry.list().map(({ key }) => key)).toEqual([
      'page-provider',
      'synthetic-provider',
      'token-provider'
    ]);
  });

  it('rejects capability declarations without matching methods', () => {
    const fake = adapter('invalid-capability', 'page');
    fake.capabilities = { ...fake.capabilities, supportsConnectionTest: true };
    expect(() => assertProviderAdapterContract(fake)).toThrow(/supportsConnectionTest/);
  });

  it('rejects credentials in championship source fields', () => {
    expect(() => assertChampionshipSourceFields([
      { key: 'api_key', label: 'Clé', type: 'secret', required: true }
    ])).toThrow(/must not contain credentials/);
  });

  it('contains no championship-specific branch in the generic core', () => {
    const core = [
      readFileSync(new URL('../src/providers/contracts.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/providers/registry.ts', import.meta.url), 'utf8')
    ].join('\n').toLowerCase();
    expect(core).not.toContain('wrc');
    expect(core).not.toContain('world rally');
  });
});
