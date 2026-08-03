export type CorrectionEditorKind = 'championship' | 'circuit' | 'status' | 'published' | 'datetime' | 'text';

export function correctionEditorKind(field: string): CorrectionEditorKind {
  if (field === 'championship_id') return 'championship';
  if (field === 'circuit_id') return 'circuit';
  if (field === 'status') return 'status';
  if (field === 'published') return 'published';
  if (field === 'starts_at' || field === 'ends_at') return 'datetime';
  return 'text';
}

export function editableCorrectionValue(field: string, value: unknown): string {
  if (value === null) return '';
  if (correctionEditorKind(field) === 'datetime' && typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 16);
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function parsedCorrectionValue(field: string, value: string): unknown {
  const kind = correctionEditorKind(field);
  if (kind === 'published') return value === 'true';
  if (kind === 'datetime') return value ? new Date(`${value}Z`).toISOString() : null;
  if (kind === 'circuit' && value === '') return null;
  return value;
}
