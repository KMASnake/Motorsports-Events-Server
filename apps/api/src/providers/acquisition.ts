import {
  ProviderAcquisitionError,
  type AcquiredProviderSourceItem,
  type FetchWorkUnitResult,
  type JsonObject,
  type ProviderItemAnomaly,
  type ProviderSourceEntityKind
} from './contracts.js';
import { sanitizeProviderSourceData } from './sourceStorage.js';

export const MAX_PROVIDER_PAGES_PER_SCOPE = 1_000;
export const MAX_PROVIDER_ITEMS_PER_UNIT = 500;

export type PageCursor = JsonObject & {
  readonly page: number;
  readonly visited: readonly string[];
};

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProviderAcquisitionError('invalid_provider_payload', 'Réponse fournisseur structurellement invalide.');
  }
  return value as Record<string, unknown>;
};

export function validatePageCursor(value: unknown): PageCursor {
  const row = object(value);
  if (!Number.isSafeInteger(row.page) || Number(row.page) < 1 || Number(row.page) > MAX_PROVIDER_PAGES_PER_SCOPE) {
    throw new Error('Curseur de page invalide.');
  }
  if (!Array.isArray(row.visited) || row.visited.length > MAX_PROVIDER_PAGES_PER_SCOPE
    || row.visited.some((entry) => typeof entry !== 'string' || entry.length > 128)) {
    throw new Error('Historique de pagination invalide.');
  }
  return { page: Number(row.page), visited: [...row.visited] as string[] };
}

export function advancePageCursor(cursor: PageCursor, nextPage: number): PageCursor {
  if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > MAX_PROVIDER_PAGES_PER_SCOPE) {
    throw new ProviderAcquisitionError('pagination_limit_exceeded', 'Pagination fournisseur hors limites.');
  }
  const current = `page:${cursor.page}`;
  const next = `page:${nextPage}`;
  if (cursor.visited.includes(current) || cursor.visited.includes(next) || current === next) {
    throw new ProviderAcquisitionError('pagination_loop', 'Boucle de pagination fournisseur détectée.');
  }
  return { page: nextPage, visited: [...cursor.visited, current] };
}

type PageResolution =
  | { readonly complete: true; readonly completionReason: 'end_of_collection' | 'explicit_empty_scope' }
  | { readonly complete: false; readonly nextCursor: PageCursor };

const optionalInteger = (value: unknown, label: string): number | null | undefined => {
  if (value === null || value === undefined) return value;
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ProviderAcquisitionError('pagination_inconsistent', `${label} fournisseur invalide.`);
  }
  return Number(value);
};

/**
 * Provider pagination evidence, strongest first: explicit has-next, explicit
 * next page, then total page count. An empty item array is never evidence by
 * itself. Contradictory metadata stops the stream instead of fabricating
 * completeness.
 */
export function resolveProviderPage(payload: unknown, cursor: PageCursor, rowsLength: number): PageResolution {
  const envelope = object(payload);
  const raw = envelope.pagination ?? envelope.meta;
  if (raw === undefined || raw === null) {
    if (rowsLength === 0) {
      throw new ProviderAcquisitionError('pagination_termination_unproven', 'Page vide sans preuve de terminaison.');
    }
    return { complete: false, nextCursor: advancePageCursor(cursor, cursor.page + 1) };
  }
  const metadata = object(raw);
  const hasNextRaw = metadata.has_next_page ?? metadata.hasNextPage;
  if (hasNextRaw !== undefined && typeof hasNextRaw !== 'boolean') {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Indicateur has_next_page invalide.');
  }
  const hasNext = hasNextRaw as boolean | undefined;
  const nextRaw = Object.hasOwn(metadata, 'next_page') ? metadata.next_page : metadata.nextPage;
  const nextPage = optionalInteger(nextRaw, 'next_page');
  const totalPageRaw = metadata.total_pages ?? metadata.totalPages;
  const totalPages = optionalInteger(totalPageRaw, 'total_pages');

  if (totalPages !== undefined && totalPages !== null && cursor.page > totalPages) {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Page courante supérieure au total fournisseur.');
  }
  if (hasNext === true && nextPage === null) {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Page suivante annoncée mais explicitement absente.');
  }
  if (hasNext === false && typeof nextPage === 'number') {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Page suivante présente malgré une terminaison annoncée.');
  }
  if (totalPages && cursor.page === totalPages && (hasNext === true || typeof nextPage === 'number')) {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Pagination annoncée au-delà de la dernière page.');
  }
  if (totalPages && cursor.page < totalPages && (hasNext === false || nextPage === null)) {
    throw new ProviderAcquisitionError('pagination_inconsistent', 'Terminaison annoncée avant total_pages.');
  }

  if (hasNext === true || typeof nextPage === 'number') {
    const candidate = typeof nextPage === 'number' ? nextPage : cursor.page + 1;
    if (totalPages && candidate > totalPages) {
      throw new ProviderAcquisitionError('pagination_inconsistent', 'Page suivante supérieure au total fournisseur.');
    }
    return { complete: false, nextCursor: advancePageCursor(cursor, candidate) };
  }
  if (hasNext === false || nextPage === null || (totalPages !== undefined && totalPages !== null && cursor.page === totalPages)) {
    return { complete: true, completionReason: rowsLength === 0 && cursor.page === 1 ? 'explicit_empty_scope' : 'end_of_collection' };
  }
  if (totalPages && cursor.page < totalPages) {
    return { complete: false, nextCursor: advancePageCursor(cursor, cursor.page + 1) };
  }
  if (rowsLength === 0) {
    throw new ProviderAcquisitionError('pagination_termination_unproven', 'Page vide sans preuve de terminaison.');
  }
  return { complete: false, nextCursor: advancePageCursor(cursor, cursor.page + 1) };
}

export interface ProviderCursorInvalidationEvidence {
  readonly kind: 'provider_cursor_rejected';
  readonly providerCode: string;
}

export function seasonRestartAfterCursorInvalidation<Raw, Cursor extends JsonObject>(input: {
  season: number;
  initialCursor: Cursor;
  evidence: ProviderCursorInvalidationEvidence;
  requestCount: number;
}): FetchWorkUnitResult<Raw, Cursor> {
  if (!input.evidence.providerCode.trim()) {
    throw new ProviderAcquisitionError('cursor_invalidation_unproven', 'Preuve fournisseur d’invalidation absente.');
  }
  return {
    status: 'cursor_invalid', items: [], itemAnomalies: [], nextCursor: input.initialCursor,
    requestCount: input.requestCount, complete: false, completionReason: null,
    safeRestart: { scope: 'season', season: input.season }
  };
}

export function providerRows(payload: unknown, keys: readonly string[]): readonly unknown[] {
  const row = object(payload);
  for (const key of keys) {
    const value = row[key];
    if (value === null) return [];
    if (Array.isArray(value)) {
      if (value.length > MAX_PROVIDER_ITEMS_PER_UNIT) {
        throw new ProviderAcquisitionError('provider_unit_too_large', 'Unité fournisseur trop volumineuse.');
      }
      return value;
    }
  }
  throw new ProviderAcquisitionError('invalid_provider_payload', 'Collection fournisseur absente ou invalide.');
}

const sourceString = (row: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

export function validateProviderSourceItems(input: {
  rows: readonly unknown[];
  season: number;
  entityKind: ProviderSourceEntityKind;
  idKeys: readonly string[];
  parentIdKeys?: readonly string[];
}): { items: AcquiredProviderSourceItem[]; anomalies: ProviderItemAnomaly[] } {
  const items: AcquiredProviderSourceItem[] = [];
  const anomalies: ProviderItemAnomaly[] = [];
  input.rows.forEach((raw, index) => {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Objet source attendu.');
      const row = raw as Record<string, unknown>;
      const externalId = sourceString(row, input.idKeys);
      if (!externalId || externalId.length > 512) throw new Error('Identité source absente ou invalide.');
      for (const key of ['date','dateEvent','starts_at','start_at','strTimestamp','ends_at','end_at']) {
        if (typeof row[key] === 'string' && Number.isNaN(Date.parse(row[key] as string))) {
          throw new Error('Date source invalide.');
        }
      }
      const declaredSeason = sourceString(row, ['season', 'year', 'intYear']);
      if (declaredSeason !== null && /^\d{4}$/.test(declaredSeason) && Number(declaredSeason) !== input.season) {
        throw new Error('Saison source incohérente.');
      }
      const start = sourceString(row, ['starts_at', 'start_at', 'strTimestamp']);
      const end = sourceString(row, ['ends_at', 'end_at']);
      if (start && end && !Number.isNaN(Date.parse(start)) && !Number.isNaN(Date.parse(end))
        && Date.parse(end) < Date.parse(start)) throw new Error('Fin source antérieure au début.');
      items.push({
        entityKind: input.entityKind,
        externalId,
        identityIsSynthetic: false,
        parentExternalId: input.parentIdKeys ? sourceString(row, input.parentIdKeys) : null,
        season: input.season,
        sourceData: sanitizeProviderSourceData(row as JsonObject)
      });
    } catch (error) {
      anomalies.push({
        scope: 'item', index, code: 'invalid_provider_item',
        message: error instanceof Error ? error.message : 'Élément fournisseur invalide.',
        externalId: raw && typeof raw === 'object' && !Array.isArray(raw)
          ? sourceString(raw as Record<string, unknown>, input.idKeys) : null
      });
    }
  });
  return { items, anomalies };
}
