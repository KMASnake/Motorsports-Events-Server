import { describe, expect, it } from 'vitest';
import {
  createSessionBody,
  normalizedSessionDates,
  publicSessionQuery,
  sessionListQuery,
  updateSessionBody,
  validateSessionPeriod
} from '../src/lib/sessionContracts.js';

describe('Session contracts', () => {
  it('requires offsets and normalizes instants to UTC', () => {
    const parsed = createSessionBody.parse({
      title: 'Essais',
      starts_at: '2026-06-12T14:00:00+02:00', ends_at: '2026-06-12T15:00:00+02:00'
    });
    expect(normalizedSessionDates(parsed)).toMatchObject({
      starts_at: '2026-06-12T12:00:00.000Z', ends_at: '2026-06-12T13:00:00.000Z',
      status: 'scheduled', published: true
    });
    expect(createSessionBody.safeParse({ title: 'Essais', starts_at: '2026-06-12T14:00:00' }).success).toBe(false);
  });

  it('accepts midnight, DST, overlap-compatible periods and an absent end', () => {
    expect(validateSessionPeriod('2026-06-13T23:30:00Z', '2026-06-14T01:00:00Z')).toBeNull();
    expect(validateSessionPeriod('2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00')).toBeNull();
    expect(validateSessionPeriod('2026-06-12T14:00:00Z', null)).toBeNull();
    expect(validateSessionPeriod('2026-06-12T15:00:00Z', '2026-06-12T14:00:00Z')).toContain('postérieure');
  });

  it('rejects technical fields, empty patches and invalid list filters', () => {
    expect(createSessionBody.safeParse({ title: 'Course', starts_at: '2026-06-12T14:00:00Z', origin: 'provider' }).success).toBe(false);
    expect(createSessionBody.safeParse({ name: 'Course', type: 'race', starts_at: '2026-06-12T14:00:00Z' }).success).toBe(false);
    expect(updateSessionBody.safeParse({}).success).toBe(false);
    expect(sessionListQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(sessionListQuery.safeParse({ sort: 'drop table sessions' }).success).toBe(false);
    expect(sessionListQuery.parse({ page: '2', page_size: '10', sort: 'title', direction: 'desc' }))
      .toMatchObject({ page: 2, page_size: 10, sort: 'title', direction: 'desc' });
  });

  it('strictly validates public filters and excludes draft', () => {
    expect(publicSessionQuery.parse({ status: 'scheduled', from: '2026-06-12T14:00:00Z' }))
      .toEqual({ status: 'scheduled', from: '2026-06-12T14:00:00Z' });
    expect(publicSessionQuery.safeParse({ status: 'draft' }).success).toBe(false);
    expect(publicSessionQuery.safeParse({ provider_key: 'hidden' }).success).toBe(false);
    expect(publicSessionQuery.safeParse({ from: '2026-06-12T14:00:00' }).success).toBe(false);
  });
});
