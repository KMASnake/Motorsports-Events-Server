import { describe, expect, it } from 'vitest';
import {
  MAX_PROVIDER_SOURCE_BYTES,
  sanitizeProviderSourceData
} from '../src/providers/sourceStorage.js';

describe('Lot 5.6 provider source storage boundary', () => {
  it('removes sensitive fields recursively before persistence', () => {
    expect(sanitizeProviderSourceData({
      id: 'race-1',
      Authorization: 'Bearer canary',
      nested: {
        cookie: 'session=canary',
        API_KEY: 'canary',
        name: 'Grand Prix'
      },
      rows: [{ token: 'canary', value: 42 }]
    })).toEqual({
      id: 'race-1',
      nested: { name: 'Grand Prix' },
      rows: [{ value: 42 }]
    });
  });

  it('refuses credentialized URLs', () => {
    expect(() => sanitizeProviderSourceData({ url: 'https://user:secret@provider.example/events' }))
      .toThrow(/Credentialized/);
  });

  it('accepts bounded structured data and rejects oversized data', () => {
    expect(sanitizeProviderSourceData({ payload: 'x'.repeat(1_000) })).toBeTruthy();
    expect(() => sanitizeProviderSourceData({ payload: 'x'.repeat(MAX_PROVIDER_SOURCE_BYTES) }))
      .toThrow(/exceeds/);
  });
});

