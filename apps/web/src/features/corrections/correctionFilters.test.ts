import { describe, expect, it } from 'vitest';
import { CORRECTIONS_PER_PAGE, correctionPage, filterCorrections, type CorrectionFilters, type CorrectionRow } from './correctionFilters';

const row = (overrides: Partial<CorrectionRow> = {}): CorrectionRow => ({
  id: 'correction-1', event_id: 'event-1', event_name: 'Grand Prix', championship_id: 'f1',
  championship_name: 'Formule 1', provider_key: 'ocblacktop', field_name: 'name',
  provider_value: 'Source', override_value: 'Local', status: 'active', created_by: 'admin',
  updated_at: '2026-08-03T10:00:00Z', last_provider_seen_at: null, conflict_detected_at: null,
  ...overrides
});
const defaults: CorrectionFilters = { query: '', championship: 'all', provider: 'all', field: 'all', status: 'all', conflict: 'all', author: 'all', updatedFrom: '', updatedTo: '', minimumFields: 1 };
const filter = (rows: CorrectionRow[], overrides: Partial<CorrectionFilters>) => filterCorrections(rows, { ...defaults, ...overrides }, (key) => `provider:${key}`, (field) => field);

describe('filtres Corrections', () => {
  it('combine fournisseur, championnat, champ, statut et conflit', () => {
    const rows = [row(), row({ id: 'correction-2', event_id: 'event-2', championship_id: 'wec', provider_key: 'other', field_name: 'status', status: 'conflict' })];
    expect(filter(rows, { provider: 'provider:other', championship: 'wec', field: 'status', status: 'conflict', conflict: 'yes' })).toHaveLength(1);
    expect(filter(rows, { conflict: 'no' }).map((item) => item.id)).toEqual(['correction-1']);
  });

  it('filtre auteur, période et nombre de champs par événement', () => {
    const rows = [row(), row({ id: 'correction-2', field_name: 'status' }), row({ id: 'correction-3', event_id: 'event-2', created_by: 'other', updated_at: '2026-07-01T10:00:00Z' })];
    expect(filter(rows, { author: 'admin', updatedFrom: '2026-08-01', minimumFields: 2 })).toHaveLength(2);
  });
});

describe('pagination Corrections', () => {
  it('limite chaque page à dix corrections', () => {
    const rows = Array.from({ length: 23 }, (_, index) => row({ id: `correction-${index}` }));
    expect(CORRECTIONS_PER_PAGE).toBe(10);
    expect(correctionPage(rows, 1)).toHaveLength(10);
    expect(correctionPage(rows, 2)[0].id).toBe('correction-10');
    expect(correctionPage(rows, 3)).toHaveLength(3);
  });
});
