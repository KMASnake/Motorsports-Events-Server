import { describe, expect, it } from 'vitest';
import { correctionOverrideBody, correctionReference } from '../src/lib/correctionValue.js';

const accepted = [
  ['championship_id', 'f1'], ['circuit_id', 'monza'], ['circuit_id', null],
  ['name', 'Grand Prix'], ['slug', 'grand-prix'], ['category', null],
  ['starts_at', '2026-08-09T10:30:00+02:00'], ['ends_at', null],
  ['status', 'postponed'], ['published', false], ['description', 'Texte'],
  ['session_title', 'Superpole'], ['session_title', null]
] as const;

describe('typed correction override values', () => {
  it.each(accepted)('accepts %s', (field_name, override_value) => {
    expect(correctionOverrideBody.safeParse({ field_name, override_value }).success).toBe(true);
  });

  it.each([
    ['championship_id', null], ['circuit_id', 42], ['name', false],
    ['slug', 'Slug invalide'], ['starts_at', '2026-08-09 10:30'],
    ['ends_at', 0], ['status', 'unknown'], ['published', 'true'],
    ['description', { arbitrary: true }], ['session_title', false], ['timezone', 'UTC']
  ])('rejects incompatible %s value', (field_name, override_value) => {
    expect(correctionOverrideBody.safeParse({ field_name, override_value }).success).toBe(false);
  });

  it('normalizes offset dates to UTC', () => {
    const parsed = correctionOverrideBody.parse({ field_name: 'starts_at', override_value: '2026-08-09T10:30:00+02:00' });
    expect(parsed.override_value).toBe('2026-08-09T08:30:00.000Z');
  });

  it('identifies only database references', () => {
    expect(correctionReference(correctionOverrideBody.parse({ field_name: 'championship_id', override_value: 'f1' })))
      .toEqual({ table: 'championships', id: 'f1' });
    expect(correctionReference(correctionOverrideBody.parse({ field_name: 'circuit_id', override_value: null }))).toBeNull();
    expect(correctionReference(correctionOverrideBody.parse({ field_name: 'published', override_value: true }))).toBeNull();
  });
});
