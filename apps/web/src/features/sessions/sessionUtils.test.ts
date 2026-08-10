import { describe, expect, it } from 'vitest';
import { deduplicateTitles, localDateTime, sessionPayload } from './sessionUtils';

describe('interface Sessions', () => {
  it('déduplique les suggestions sans imposer un référentiel', () => {
    expect(deduplicateTitles(['FP1',' fp1 ','Main Event',''])).toEqual(['FP1','Main Event']);
  });
  it('transforme une saisie locale en instant avec offset explicite', () => {
    expect(sessionPayload({ title:'FP1',starts_at:'2026-10-25T02:30',ends_at:'',status:'scheduled',published:true,description:'' }).starts_at).toMatch(/Z$/);
  });
  it('présente les instants reçus dans le contrôle local', () => {
    expect(localDateTime('2026-07-01T08:00:00Z')).toMatch(/^2026-07-01T/);
  });
});
