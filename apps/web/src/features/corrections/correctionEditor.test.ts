import { describe, expect, it } from 'vitest';
import { correctionEditorKind, editableCorrectionValue, parsedCorrectionValue } from './correctionEditor';

describe('éditeur typé des corrections', () => {
  it('utilise les référentiels et énumérations adaptés', () => {
    expect(correctionEditorKind('championship_id')).toBe('championship');
    expect(correctionEditorKind('circuit_id')).toBe('circuit');
    expect(correctionEditorKind('status')).toBe('status');
    expect(correctionEditorKind('published')).toBe('published');
    expect(correctionEditorKind('name')).toBe('text');
  });

  it('convertit les dates UTC pour le contrôle date et heure', () => {
    expect(editableCorrectionValue('starts_at', '2026-08-03T14:35:00.000Z')).toBe('2026-08-03T14:35');
    expect(parsedCorrectionValue('starts_at', '2026-08-03T16:05')).toBe('2026-08-03T16:05:00.000Z');
    expect(parsedCorrectionValue('ends_at', '')).toBeNull();
  });

  it('convertit les choix booléens et les circuits facultatifs', () => {
    expect(parsedCorrectionValue('published', 'false')).toBe(false);
    expect(parsedCorrectionValue('circuit_id', '')).toBeNull();
  });
});
