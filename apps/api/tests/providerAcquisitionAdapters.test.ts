import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PROVIDER_ITEMS_PER_UNIT, seasonRestartAfterCursorInvalidation } from '../src/providers/acquisition.js';
import type { FetchWorkUnitInput, JsonObject, ProviderRequestGate } from '../src/providers/contracts.js';
import { ProviderAcquisitionError } from '../src/providers/contracts.js';
import { OcBlackTopAdapter, TheSportsDbAdapter } from '../src/providers/realAdapters.js';
import { mapSource, normalize, type MappingConfig, type SourceEnvelope } from '../src/normalization/deterministicNormalization.js';

const ocBlackTopF1GrandPrix = JSON.parse(readFileSync(new URL('./fixtures/ocblacktop-f1-2026-grand-prix.json', import.meta.url), 'utf8')) as JsonObject;

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
  it('projects a real OCBlackTop Grand Prix into one meeting and its canonical Event-as-Session children', async () => {
    const transport=vi.fn(async()=>response({data:[ocBlackTopF1GrandPrix],pagination:{next_page:null,total_pages:1}}));
    const result=await new OcBlackTopAdapter(transport).fetchWorkUnit(ocInput());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.itemAnomalies).toEqual([]);
    expect(result.items).toHaveLength(6);
    const [meeting,...events]=result.items;
    expect(meeting).toMatchObject({entityKind:'meeting',externalId:'5df7b804-f7bd-48d5-9bbe-07db372ed72f',season:2026,parentExternalId:null,sourceData:{name:'Abu Dhabi Grand Prix',status:'scheduled',circuit_id:'10358903-f251-4a40-8301-8966c208d860',starts_at:'2026-12-04T09:30:00.000Z',ends_at:'2026-12-06T15:00:00.000Z'}});
    expect(events.map(item=>({id:item.externalId,parent:item.parentExternalId,kind:item.entityKind,name:item.sourceData.name,type:item.sourceData.session_type,start:item.sourceData.starts_at,end:item.sourceData.ends_at}))).toEqual([
      {id:'cfb05997-ba80-4d6b-bf04-bcd5ebf3d9f9',parent:meeting?.externalId,kind:'event',name:'FP1',type:'practice',start:'2026-12-04T09:30:00.000Z',end:'2026-12-04T10:30:00.000Z'},
      {id:'3f88f172-20df-4d23-9dee-8d18718747e6',parent:meeting?.externalId,kind:'event',name:'FP2',type:'practice',start:'2026-12-04T13:00:00.000Z',end:'2026-12-04T14:00:00.000Z'},
      {id:'442b969d-e32c-4e76-8e0a-5c86b1ad86ff',parent:meeting?.externalId,kind:'event',name:'FP3',type:'practice',start:'2026-12-05T10:30:00.000Z',end:'2026-12-05T11:30:00.000Z'},
      {id:'3c56d900-ec40-450e-b8ac-bb11b7bf7a71',parent:meeting?.externalId,kind:'event',name:'Qualifying',type:'qualifying',start:'2026-12-05T14:00:00.000Z',end:'2026-12-05T15:00:00.000Z'},
      {id:'2c54fa38-a48f-4b12-8f62-af26244226ae',parent:meeting?.externalId,kind:'event',name:'Race',type:'race',start:'2026-12-06T13:00:00.000Z',end:'2026-12-06T15:00:00.000Z'}
    ]);

    const mapping:MappingConfig={version:'fixture',rulesVersion:'fixture',championshipIds:{formula1:'f1'},circuitIds:{'10358903-f251-4a40-8301-8966c208d860':'yas-marina'},sessionTypes:{practice:'practice',qualifying:'qualifying',race:'race'},statuses:{scheduled:'scheduled'}};
    const envelope=(item:typeof result.items[number]):SourceEnvelope=>({id:item.externalId,kind:item.entityKind==='meeting'?'meeting':'event',sourceHash:'fixture',providerKey:'ocblacktop',championshipSourceId:'formula1',season:item.season,data:item.sourceData,corrections:[],lastChangedAt:'2026-08-27T00:00:00.000Z',lastObservedAt:'2026-08-27T00:00:00.000Z',observation:'present',traversalComplete:true,providerStartedAt:item.sourceData.starts_at as string,providerEndedAt:item.sourceData.ends_at as string,theoreticalEndAt:null,endEstimated:false,endProvenance:'provider',now:'2026-08-27T00:00:00.000Z'});
    expect(mapSource(envelope(meeting!),mapping)).toMatchObject({resourceKind:'meeting',name:'Abu Dhabi Grand Prix',championshipId:'f1',circuitId:'yas-marina',status:'scheduled',startsAt:'2026-12-04T09:30:00.000Z',endsAt:'2026-12-06T15:00:00.000Z'});
    expect(mapSource(envelope(events[0]!),mapping)).toMatchObject({resourceKind:'event',name:'FP1',championshipId:'f1',circuitId:'yas-marina',sessionType:'practice',status:'scheduled',startsAt:'2026-12-04T09:30:00.000Z',endsAt:'2026-12-04T10:30:00.000Z'});
    expect(normalize(envelope(events[0]!),{...mapping,circuitIds:{}},[],null).resolution).toMatchObject({decision:'review',reason:'required_identity_unknown'});
  });

  it.each([
    ['practice','practice'],['qualifying','qualifying'],['sprint','sprint'],['sprint qualifying','sprint_qualifying'],['sprint shootout','sprint_qualifying'],['race','race'],['future-format','other']
  ] as const)('keeps provider session type %s configurable as %s',async(rawType,canonical)=>{
    const fixture={...ocBlackTopF1GrandPrix,schedule:[{id:`session-${rawType}`,name:rawType,type:rawType,status:'scheduled',startTime:'2026-12-04T09:30:00.000Z',endTime:'2026-12-04T10:30:00.000Z'}]};
    const result=await new OcBlackTopAdapter(async()=>response({data:[fixture],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    const item=result.items[1]!;
    const config:MappingConfig={version:'types',rulesVersion:'types',championshipIds:{formula1:'f1'},circuitIds:{'10358903-f251-4a40-8301-8966c208d860':'yas-marina'},sessionTypes:{practice:'practice',qualifying:'qualifying',sprint:'sprint','sprint qualifying':'sprint_qualifying','sprint shootout':'sprint_qualifying',race:'race'},statuses:{scheduled:'scheduled'}};
    const mapped=mapSource({id:item.externalId,kind:'event',sourceHash:'fixture',providerKey:'ocblacktop',championshipSourceId:'formula1',season:2026,data:item.sourceData,corrections:[],lastChangedAt:'2026-08-27T00:00:00Z',lastObservedAt:'2026-08-27T00:00:00Z',traversalComplete:true,providerStartedAt:null,providerEndedAt:null,theoreticalEndAt:null,endEstimated:false,endProvenance:null,now:'2026-08-27T00:00:00Z'},config);
    expect(mapped).toMatchObject({sessionType:canonical,name:rawType});
  });

  it('distinguishes absent, empty and structurally invalid schedules',async()=>{
    const absent=await new OcBlackTopAdapter(async()=>response({data:[{id:'legacy'}],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    expect(absent.items).toHaveLength(1);expect(absent.items[0]).toMatchObject({entityKind:'event',externalId:'legacy'});
    const empty=await new OcBlackTopAdapter(async()=>response({data:[{id:'empty',status:'scheduled',schedule:[]}],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    expect(empty.items).toHaveLength(1);expect(empty.items[0]).toMatchObject({entityKind:'meeting',sourceData:{starts_at:null,ends_at:null}});
    const malformed=await new OcBlackTopAdapter(async()=>response({data:[{id:'bad',schedule:'nope'}],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    expect(malformed.items).toEqual([]);expect(malformed.itemAnomalies).toEqual([expect.objectContaining({externalId:'bad',code:'invalid_provider_item'})]);
  });

  it('never truncates meeting bounds when one scheduled session has invalid temporality',async()=>{
    const fixture={...ocBlackTopF1GrandPrix,schedule:[...(ocBlackTopF1GrandPrix.schedule as JsonObject[]).slice(0,4),{...(ocBlackTopF1GrandPrix.schedule as JsonObject[])[4],endTime:'invalid'}]};
    const result=await new OcBlackTopAdapter(async()=>response({data:[fixture],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    expect(result.items[0]).toMatchObject({entityKind:'meeting',sourceData:{starts_at:null,ends_at:null}});
    expect(result.itemAnomalies).toEqual([expect.objectContaining({externalId:'2c54fa38-a48f-4b12-8f62-af26244226ae',code:'invalid_provider_item'})]);
  });

  it('rejects incomplete and colliding source identities without synthesizing them',async()=>{
    const schedule=[{name:'No id',type:'practice',status:'scheduled',startTime:'2026-12-04T09:30:00Z',endTime:'2026-12-04T10:30:00Z'},null,{id:'duplicate',name:'A',type:'race',status:'scheduled',startTime:'2026-12-06T13:00:00Z',endTime:'2026-12-06T15:00:00Z'},{id:'duplicate',name:'B',type:'race',status:'scheduled',startTime:'2026-12-06T13:00:00Z',endTime:'2026-12-06T15:00:00Z'}];
    const result=await new OcBlackTopAdapter(async()=>response({data:[{...ocBlackTopF1GrandPrix,schedule}],pagination:{next_page:null}})).fetchWorkUnit(ocInput());
    expect(result.items.filter(item=>item.entityKind==='event')).toHaveLength(1);
    expect(result.items.some(item=>item.identityIsSynthetic)).toBe(false);
    expect(result.itemAnomalies).toHaveLength(3);
  });

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

  it('uses the maintainer-approved TheSportsDB v1 credential path without retaining the canary', async () => {
    const secret = 'THESPORTSDB_CANARY_NEVER_OBSERVABLE';
    const transport = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toEqual({ accept: 'application/json' });
      return response({ events: [{ idEvent: 'tsdb-1', apiKey: secret, dateEvent: '1950-01-01' }] });
    });
    const adapter = new TheSportsDbAdapter(transport);
    const result = await adapter.fetchWorkUnit({
      ...ocInput(),
      credentials: { api_key: secret },
      providerConfig: { base_url: 'https://www.thesportsdb.com/api/v1/json' },
      sourceConfig: { strategy: 'league-season-v1', external_id: '4380' },
      cursor: { page: 1, visited: [] }
    });
    expect(result).toMatchObject({ status: 'complete', complete: true, completionReason: 'end_of_collection' });
    const calledUrl = transport.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain(`/api/v1/json/${secret}/eventsseason.php?id=4380&s=2026`);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.items[0]?.sourceData).not.toHaveProperty('apiKey');
  });

  it('keeps TheSportsDB v1 error surfaces free of its path credential', async () => {
    const secret = 'THESPORTSDB_ERROR_CANARY';
    const adapter = new TheSportsDbAdapter(async () => response({ message: secret }, 401));
    let failure: unknown;
    try { await adapter.fetchWorkUnit({ ...ocInput(), credentials: { api_key: secret }, providerConfig: { base_url: 'https://www.thesportsdb.com/api/v1/json' }, sourceConfig: { strategy: 'league-season-v1', external_id: '4380' } }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: 'http_401', complete: false });
    expect(JSON.stringify(failure)).not.toContain(secret);
  });

  it('marks an explicitly empty TheSportsDB v1 season complete', async () => {
    const adapter = new TheSportsDbAdapter(async () => response({ events: [] }));
    const result = await adapter.fetchWorkUnit({
      ...ocInput(), providerConfig: { base_url: 'https://www.thesportsdb.com/api/v1/json' },
      sourceConfig: { strategy: 'league-season-v1', external_id: '4380' }
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
