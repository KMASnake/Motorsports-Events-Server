import { describe, expect, it } from 'vitest';
import {
  MAX_PROVIDER_SOURCE_BYTES,
  sanitizeProviderSourceData
} from '../src/providers/sourceStorage.js';

describe('Lot 5.6 provider source storage boundary', () => {
  it('removes sensitive fields recursively before persistence', () => {
    const canaries = [
      'authorization-canary', 'access-canary', 'refresh-canary',
      'client-canary', 'api-canary', 'x-api-canary', 'cookie-canary'
    ];
    const sanitized = sanitizeProviderSourceData({
      id: 'race-1',
      Authorization: canaries[0],
      accessToken: canaries[1],
      refresh_token: canaries[2],
      CLIENT_SECRET: canaries[3],
      nested: {
        cookie: canaries[6],
        apiKey: canaries[4],
        'x-api-key': canaries[5],
        name: 'Grand Prix'
      },
      rows: [{ ToKeN: 'token-canary', value: 42 }]
    });
    expect(sanitized).toEqual({
      id: 'race-1',
      nested: { name: 'Grand Prix' },
      rows: [{ value: 42 }]
    });
    const serialized = JSON.stringify(sanitized);
    for (const canary of canaries) expect(serialized).not.toContain(canary);
  });

  it.each([
    'https://user:secret@provider.example/events',
    'https://provider.example/events?api_key=query-canary',
    'https://provider.example/events?accessToken=query-canary',
    'https://provider.example/events?X-API-Key=query-canary'
  ])('refuses credentialized URL %s', (url) => {
    expect(() => sanitizeProviderSourceData({ url })).toThrow(/Credentialized/);
  });

  it('accepts bounded structured data and rejects oversized data', () => {
    expect(sanitizeProviderSourceData({ payload: 'x'.repeat(1_000) })).toBeTruthy();
    expect(() => sanitizeProviderSourceData({ payload: 'x'.repeat(MAX_PROVIDER_SOURCE_BYTES) }))
      .toThrow(/exceeds/);
  });
});
