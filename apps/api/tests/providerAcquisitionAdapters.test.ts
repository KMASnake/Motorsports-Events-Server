import { describe, expect, it, vi } from 'vitest';
import { MAX_PROVIDER_ITEMS_PER_UNIT, seasonRestartAfterCursorInvalidation } from '../src/providers/acquisition.js';
import type { FetchWorkUnitInput, JsonObject, ProviderRequestGate } from '../src/providers/contracts.js';
import { ProviderAcquisitionError } from '../src/providers/contracts.js';
import { OcBlackTopAdapter, TheSportsDbAdapter } from '../src/providers/realAdapters.js';

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' }
});

const gate = (): ProviderRequestGate => ({
  beforeRequest: vi.fn(async () => ({ allowed: true, chargeId: 'charge-1' })),
  afterResponse: vi.fn(async () => undefined),
  afterError: vi.fn(async () => undefined)
});

function ocInput(overrides: Partial<FetchWorkUnitInput<JsonObject, JsonObject, JsonObject>> = {}) {
  return {
    providerInstanceId: 'provider-1',
    providerConfig: { base_url: 'https://api.ocblacktop.com/v1' },
    credentials: { api_key: 'not-a-real-secret' },
    providerChampionshipId: 'provider-championship-1',
    championshipId: 'championship-1',
    sourceConfig: { strategy: 'series-events-v1', external_id: 'formula1', endpoint_template: '/{series}/events' },
    phase: 'current' as const,
    season: 2026,
    cursor: { page: 1, visited: [] },
    signal: new AbortController().signal,
    ...overrides
  };
}

describe('Lot 5.6-B provider acquisition adapters', () => {
  it('paginates OCBlackTop until explicit provider termination and charges through the request gate', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ id: 'evt-1', date: '1950-01-01T12:00:00Z', apiKey: 'must-disappear' }], pagination: { next_page: 2, total_pages: 2 } }))
      .mockResolvedValueOnce(response({ data: [{ id: 'evt-2', date: '1969-12-31T23:59:00Z' }], pagination: { next_page: null, total_pages: 2 } }));
    const requestGate = gate();
    const adapter = new OcBlackTopAdapter(transport);
    const first = await adapter.fetchWorkUnit(ocInput({ requestGate }));
    expect(first).toMatchObject({ status: 'progress', complete: false, nextCursor: { page: 2, visited: ['page:1'] } });
    expect(first.items[0]?.sourceData).not.toHaveProperty('apiKey');
    const second = await adapter.fetchWorkUnit(ocInput({ requestGate, cursor: first.nextCursor }));
    expect(second).toMatchObject({ status: 'complete', complete: true, completionReason: 'end_of_collection' });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(requestGate.beforeRequest).toHaveBeenCalledTimes(2);
    expect(requestGate.afterResponse).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['last explicit page', { data: [{ id: 'last' }], pagination: { has_next_page: false, next_page: null, total_pages: 1 } }, 'complete', 'end_of_collection'],
    ['explicitly empty collection', { data: [], pagination: { has_next_page: false, next_page: null, total_pages: 1 } }, 'complete', 'explicit_empty_scope'],
    ['empty page with next_page', { data: [], pagination: { next_page: 2, total_pages: 3 } }, 'progress', null],
    ['empty page with has_next_page', { data: [], pagination: { has_next_page: true, next_page: 2, total_pages: 3 } }, 'progress', null]
  ] as const)('uses non-contradictory pagination evidence: %s', async (_label, payload, status, reason) => {
    const adapter = new OcBlackTopAdapter(async () => response(payload));
    const result = await adapter.fetchWorkUnit(ocInput());
    expect(result.status).toBe(status);
    expect(result.complete).toBe(status === 'complete');
    expect(result.completionReason).toBe(reason);
    if (status === 'progress') expect(result.nextCursor.page).toBe(2);
  });

  it.each([
    { data: [], pagination: { has_next_page: true, next_page: null, total_pages: 3 } },
    { data: [{ id: 'evt-1' }], pagination: { has_next_page: true, next_page: 2, total_pages: 1 } },
    { data: [{ id: 'evt-1' }], pagination: { has_next_page: false, next_page: null, total_pages: 3 } }
  ])('blocks contradictory total/next/termination metadata %#', async (payload) => {
    const adapter = new OcBlackTopAdapter(async () => response(payload));
    await expect(adapter.fetchWorkUnit(ocInput())).rejects.toMatchObject({
      complete: false, anomaly: { scope: 'stream', code: 'pagination_inconsistent' }
    });
  });

  it('isolates an invalid item without hiding valid source items', async () => {
    const adapter = new OcBlackTopAdapter(async () => response({
      data: [
        { id: 'valid', date: '1900-01-01T00:00:00Z' },
        { id: 'bad-date', date: 'not-a-date' },
        { id: 'bad-season', season: '2025' },
        { id: 'bad-range', starts_at: '1969-01-02T00:00:00Z', ends_at: '1969-01-01T00:00:00Z' }
      ],
      pagination: { next_page: null }
    }));
    const result = await adapter.fetchWorkUnit(ocInput());
    expect(result.items.map((item) => item.externalId)).toEqual(['valid']);
    expect(result.itemAnomalies).toEqual([
      expect.objectContaining({ scope: 'item', index: 1, code: 'invalid_provider_item' }),
      expect.objectContaining({ scope: 'item', index: 2, code: 'invalid_provider_item' }),
      expect.objectContaining({ scope: 'item', index: 3, code: 'invalid_provider_item' })
    ]);
  });

  it('rejects a malformed or oversized stream as a blocking anomaly', async () => {
    const malformed = new OcBlackTopAdapter(async () => response({ unexpected: true }));
    await expect(malformed.fetchWorkUnit(ocInput())).rejects.toMatchObject({
      anomaly: { scope: 'stream', code: 'invalid_provider_payload' }
    });
    const oversized = new OcBlackTopAdapter(async () => response({
      data: Array.from({ length: MAX_PROVIDER_ITEMS_PER_UNIT + 1 }, (_, index) => ({ id: `evt-${index}` }))
    }));
    await expect(oversized.fetchWorkUnit(ocInput())).rejects.toMatchObject({
      anomaly: { scope: 'stream', code: 'provider_unit_too_large' }
    });
  });

  it('detects a provider pagination loop before emitting another request', async () => {
    const adapter = new OcBlackTopAdapter(async () => response({ data: [{ id: 'evt-1' }], pagination: { next_page: 1 } }));
    await expect(adapter.fetchWorkUnit(ocInput())).rejects.toEqual(expect.any(ProviderAcquisitionError));
    await expect(adapter.fetchWorkUnit(ocInput())).rejects.toMatchObject({ anomaly: { code: 'pagination_loop', scope: 'stream' } });
  });

  it('returns a season-scoped safe restart only with explicit provider invalidation evidence', () => {
    const result = seasonRestartAfterCursorInvalidation({
      season: 2026, initialCursor: { page: 1, visited: [] }, requestCount: 1,
      evidence: { kind: 'provider_cursor_rejected', providerCode: 'CURSOR_EXPIRED' }
    });
    expect(result).toMatchObject({
      status: 'cursor_invalid', complete: false, nextCursor: { page: 1, visited: [] },
      safeRestart: { scope: 'season', season: 2026 }
    });
    expect(() => seasonRestartAfterCursorInvalidation({
      season: 2026, initialCursor: { page: 1, visited: [] }, requestCount: 1,
      evidence: { kind: 'provider_cursor_rejected', providerCode: '' }
    })).toThrow(/Preuve fournisseur/);
  });

  it.each([400, 404, 410])('does not reinterpret a generic HTTP %s as cursor invalidation', async (status) => {
    const adapter = new OcBlackTopAdapter(async () => response({ message: 'generic failure' }, status));
    await expect(adapter.fetchWorkUnit(ocInput({ cursor: { page: 4, visited: ['page:1', 'page:2', 'page:3'] } })))
      .rejects.toMatchObject({ code: `http_${status}`, complete: false });
  });

  it('keeps HTTP, quota and parsing failures incomplete and free of credentials', async () => {
    const secret = 'CANARY_PROVIDER_SECRET_DO_NOT_LOG';
    const adapter = new OcBlackTopAdapter(async () => response({ message: secret }, 429));
    let failure: unknown;
    try { await adapter.fetchWorkUnit(ocInput({ credentials: { api_key: secret } })); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: 'http_429', complete: false });
    expect(JSON.stringify(failure)).not.toContain(secret);

    const malformed = new OcBlackTopAdapter(async () => response({ data: 'broken' }));
    await expect(malformed.fetchWorkUnit(ocInput())).rejects.toMatchObject({
      complete: false, anomaly: { scope: 'stream', code: 'invalid_provider_payload' }
    });
  });

  it('uses TheSportsDB v2 header authentication without exposing or retaining the canary', async () => {
    const secret = 'THESPORTSDB_CANARY_NEVER_OBSERVABLE';
    const transport = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ 'x-api-key': secret });
      return response({ events: [{ idEvent: 'tsdb-1', apiKey: secret, dateEvent: '1950-01-01' }] });
    });
    const adapter = new TheSportsDbAdapter(transport);
    const result = await adapter.fetchWorkUnit({
      ...ocInput(),
      credentials: { api_key: secret },
      providerConfig: { base_url: 'https://www.thesportsdb.com/api/v2/json' },
      sourceConfig: { strategy: 'league-season-v2', external_id: '4380' },
      cursor: { page: 1, visited: [] }
    });
    expect(result).toMatchObject({ status: 'complete', complete: true, completionReason: 'end_of_collection' });
    const calledUrl = transport.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain('/api/v2/json/schedule/league/4380/2026');
    expect(String(calledUrl)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.items[0]?.sourceData).not.toHaveProperty('apiKey');
  });

  it('keeps TheSportsDB error surfaces free of the header credential', async () => {
    const secret = 'THESPORTSDB_ERROR_CANARY';
    const adapter = new TheSportsDbAdapter(async () => response({ message: secret }, 401));
    let failure: unknown;
    try { await adapter.fetchWorkUnit({ ...ocInput(), credentials: { api_key: secret }, providerConfig: { base_url: 'https://www.thesportsdb.com/api/v2/json' }, sourceConfig: { strategy: 'league-season-v2', external_id: '4380' } }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: 'http_401', complete: false });
    expect(JSON.stringify(failure)).not.toContain(secret);
  });

  it('marks an explicitly empty TheSportsDB v2 season complete', async () => {
    const adapter = new TheSportsDbAdapter(async () => response({ events: [] }));
    const result = await adapter.fetchWorkUnit({
      ...ocInput(), providerConfig: { base_url: 'https://www.thesportsdb.com/api/v2/json' },
      sourceConfig: { strategy: 'league-season-v2', external_id: '4380' }
    });
    expect(result).toMatchObject({ status: 'complete', complete: true, completionReason: 'explicit_empty_scope' });
  });

  it('acquires WRC through its OCBlackTop seasonal strategy without a WRC adapter', async () => {
    const transport = vi.fn(async () => response({ data: { rallies: [{ rallyId: 'rally-1', date: '1969-01-01' }] } }));
    const adapter = new OcBlackTopAdapter(transport);
    const result = await adapter.fetchWorkUnit(ocInput({
      sourceConfig: { strategy: 'season-rallies-v1', external_id: 'wrc', endpoint_template: '/{series}/seasons/{year}' }
    }));
    expect(result).toMatchObject({ status: 'complete', complete: true, completionReason: 'end_of_collection' });
    expect(result.items.map((item) => item.externalId)).toEqual(['rally-1']);
    expect(String(transport.mock.calls[0]?.[0])).toContain('/v1/wrc/seasons/2026');
    expect(adapter.key).toBe('ocblacktop');
  });

  it('propagates scheduler cancellation through the existing secure HTTP boundary', async () => {
    const controller = new AbortController();
    const adapter = new OcBlackTopAdapter(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      queueMicrotask(() => controller.abort());
    }));
    await expect(adapter.fetchWorkUnit(ocInput({ signal: controller.signal }))).rejects.toMatchObject({ code: 'aborted' });
  });
});
