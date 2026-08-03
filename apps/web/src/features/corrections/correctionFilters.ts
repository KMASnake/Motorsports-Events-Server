export type CorrectionStatus = 'active' | 'conflict' | 'resolved' | 'ignored';

export interface CorrectionRow {
  id: string;
  event_id: string;
  event_name: string;
  championship_id: string;
  championship_name: string;
  provider_key: string;
  field_name: string;
  provider_value: unknown;
  override_value: unknown;
  status: CorrectionStatus;
  created_by: string;
  updated_at: string;
  last_provider_seen_at: string | null;
  conflict_detected_at: string | null;
}

export interface CorrectionFilters {
  query: string;
  championship: string;
  provider: string;
  field: string;
  status: string;
  conflict: string;
  author: string;
  updatedFrom: string;
  updatedTo: string;
  minimumFields: number;
}

export function filterCorrections(
  rows: CorrectionRow[],
  filters: CorrectionFilters,
  providerIdentity: (providerKey: string) => string,
  fieldLabel: (field: string) => string
): CorrectionRow[] {
  const counts = rows.reduce<Map<string, number>>((result, row) => {
    result.set(row.event_id, (result.get(row.event_id) ?? 0) + 1);
    return result;
  }, new Map());
  const query = filters.query.trim().toLocaleLowerCase('fr');
  const from = filters.updatedFrom ? new Date(`${filters.updatedFrom}T00:00:00`).getTime() : null;
  const to = filters.updatedTo ? new Date(`${filters.updatedTo}T23:59:59.999`).getTime() : null;
  return rows.filter((row) => {
    const updated = new Date(row.updated_at).getTime();
    const haystack = `${row.event_name} ${row.championship_name} ${row.provider_key} ${fieldLabel(row.field_name)} ${row.created_by}`.toLocaleLowerCase('fr');
    return (!query || haystack.includes(query))
      && (filters.championship === 'all' || row.championship_id === filters.championship)
      && (filters.provider === 'all' || providerIdentity(row.provider_key) === filters.provider)
      && (filters.field === 'all' || row.field_name === filters.field)
      && (filters.status === 'all' || row.status === filters.status)
      && (filters.conflict === 'all' || (filters.conflict === 'yes') === (row.status === 'conflict'))
      && (filters.author === 'all' || row.created_by === filters.author)
      && (from === null || updated >= from)
      && (to === null || updated <= to)
      && (counts.get(row.event_id) ?? 0) >= filters.minimumFields;
  });
}
