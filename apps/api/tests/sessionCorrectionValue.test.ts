import { describe, expect, it } from 'vitest';
import { parseSessionCorrectionValue, providerSessionPatch } from '../src/lib/sessionCorrectionValue.js';

describe('typed Session correction values', () => {
  it.each([
    ['title', 'Superpole'], ['starts_at', '2026-10-25T02:30:00+02:00'],
    ['ends_at', null], ['status', 'postponed'], ['published', false],
    ['description', null]
  ])('accepts %s', (field_name, override_value) => {
    expect(parseSessionCorrectionValue({ field_name, override_value }).field_name).toBe(field_name);
  });

  it('normalizes offset dates to UTC', () => {
    expect(parseSessionCorrectionValue({ field_name: 'starts_at', override_value: '2026-06-12T14:00:00+02:00' }).override_value)
      .toBe('2026-06-12T12:00:00.000Z');
  });

  it.each([
    ['type', 'race'], ['event_id', 'evt-001'], ['title', ''],
    ['starts_at', '2026-06-12T12:00:00'], ['status', 'unknown'],
    ['published', 'true'], ['description', 42]
  ])('rejects invalid %s', (field_name, override_value) => {
    expect(() => parseSessionCorrectionValue({ field_name, override_value })).toThrow();
  });

  it('strictly validates provider patches', () => {
    expect(providerSessionPatch.parse({ title: 'FP1' })).toEqual({ title: 'FP1' });
    expect(providerSessionPatch.safeParse({}).success).toBe(false);
    expect(providerSessionPatch.safeParse({ type: 'practice' }).success).toBe(false);
  });
});
