import { describe, expect, it, vi } from 'vitest';
import { MAX_PROVIDER_ITEMS_PER_UNIT } from '../src/providers/acquisition.js';
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

  it('returns a season-scoped safe restart when a resumed OCBlackTop cursor is rejected', async () => {
    const adapter = new OcBlackTopAdapter(async () => response({ message: 'gone' }, 410));
    const result = await adapter.fetchWorkUnit(ocInput({ cursor: { page: 4, visited: ['page:1', 'page:2', 'page:3'] } }));
    expect(result).toMatchObject({
      status: 'cursor_invalid', complete: false, nextCursor: { page: 1, visited: [] },
      safeRestart: { scope: 'season', season: 2026 }
    });
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

  it('treats TheSportsDB as a one-request collection with explicit empty completion', async () => {
    const transport = vi.fn(async () => response({ events: null }));
    const adapter = new TheSportsDbAdapter(transport);
    const result = await adapter.fetchWorkUnit({
      ...ocInput(),
      providerConfig: { base_url: 'https://www.thesportsdb.com/api/v1/json' },
      sourceConfig: { strategy: 'league-season-v1', external_id: '4380' },
      cursor: { page: 1, visited: [] }
    });
    expect(result).toMatchObject({ status: 'complete', complete: true, completionReason: 'explicit_empty_scope', items: [] });
    const calledUrl = transport.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain('/eventsseason.php?id=4380&s=2026');
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
