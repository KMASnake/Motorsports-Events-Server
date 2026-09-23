import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientQuery = vi.hoisted(() => vi.fn());
const poolQuery = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({
  pool: { query: poolQuery },
  withTransaction: vi.fn(async operation => operation({ query: clientQuery }))
}));

import { championshipSeasonRoutes } from '../src/routes/championshipSeasons.js';

const seasonId = '10000000-0000-4000-8000-000000000001';
const baseSeason = {
  id: seasonId,
  championship_id: 'f1',
  key: '2026',
  label: '2026',
  start_year: 2026,
  end_year: 2026,
  starts_on: '2026-01-01',
  ends_on: '2026-12-31'
};

beforeEach(() => { clientQuery.mockReset(); poolQuery.mockReset(); });

describe('F5-2 ChampionshipSeason admin routes', () => {
  it('lists seasons only after proving the Championship exists', async () => {
    poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'f1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [baseSeason] });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/championships/f1/seasons' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([baseSeason]);
    await app.close();
  });

  it('creates a cross-year season and writes its audit atomically', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('select id from championships')) return { rowCount: 1, rows: [{ id: 'f1' }] };
      if (sql.includes('insert into championship_seasons')) return { rowCount: 1, rows: [{ ...baseSeason, key: '2026/27', label: '2026/27', end_year: 2027, ends_on: '2027-05-31' }] };
      return { rowCount: 1, rows: [] };
    });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/championships/f1/seasons', payload: {
      key: '2026/27', label: '2026/27', start_year: 2026, end_year: 2027,
      starts_on: '2026-08-01', ends_on: '2027-05-31'
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ key: '2026/27', start_year: 2026, end_year: 2027 });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('admin_audit_log'))).toBe(true);
    await app.close();
  });

  it('keeps the UUID stable when mutable metadata changes', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('select * from championship_seasons')) return { rowCount: 1, rows: [baseSeason] };
      if (sql.startsWith('update championship_seasons')) return { rowCount: 1, rows: [{ ...baseSeason, label: 'Commercial 2026', end_year: 2027, ends_on: '2027-01-15' }] };
      return { rowCount: 1, rows: [] };
    });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const response = await app.inject({ method: 'PATCH', url: `/api/v1/admin/championship-seasons/${seasonId}`, payload: {
      label: 'Commercial 2026', end_year: 2027, ends_on: '2027-01-15'
    } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: seasonId, key: '2026', label: 'Commercial 2026' });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('update meetings'))).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('update events'))).toBe(false);
    await app.close();
  });

  it('rejects key mutation and preserves the stable scoped handle and UUID', async () => {
    poolQuery.mockResolvedValue({ rowCount: 1, rows: [baseSeason] });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const rejected = await app.inject({ method: 'PATCH', url: `/api/v1/admin/championship-seasons/${seasonId}`, payload: { key: 'season-2026' } });
    expect(rejected.statusCode).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();
    const unchanged = await app.inject({ method: 'GET', url: `/api/v1/admin/championship-seasons/${seasonId}` });
    expect(unchanged.json()).toMatchObject({ id: seasonId, key: '2026' });
    await app.close();
  });

  it.each([
    ['GET', '/api/v1/admin/championship-seasons/not-a-uuid', undefined],
    ['PATCH', '/api/v1/admin/championship-seasons/not-a-uuid', { label: 'Still invalid' }]
  ] as const)('rejects malformed Season UUIDs without reaching persistence', async (method, url, payload) => {
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode, response.body).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();
    expect(poolQuery).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    [{ key: '', label: '2026' }, 400],
    [{ key: '   ', label: '2026' }, 400],
    [{ key: '2026', label: '' }, 400],
    [{ key: '2026', label: '   ' }, 400],
    [{ key: '2026', label: '2026', start_year: 1949 }, 400],
    [{ key: '2026', label: '2026', end_year: 2201 }, 400],
    [{ key: '2026', label: '2026', start_year: 2027, end_year: 2026 }, 400],
    [{ key: '2026', label: '2026', starts_on: '2026-02-30' }, 400],
    [{ key: '2026', label: '2026', starts_on: '2027-01-01', ends_on: '2026-01-01' }, 400]
  ])('rejects invalid input before persistence', async (payload, status) => {
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/championships/f1/seasons', payload })).statusCode).toBe(status);
    expect(clientQuery).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    [{ start_year: 2028 }, 'start_year'],
    [{ end_year: 2025 }, 'end_year'],
    [{ starts_on: '2027-01-01' }, 'starts_on'],
    [{ ends_on: '2025-12-31' }, 'ends_on']
  ])('rejects a partial PATCH whose merged final state is invalid', async (payload, field) => {
    clientQuery.mockResolvedValueOnce({ rowCount: 1, rows: [baseSeason] });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const response = await app.inject({ method: 'PATCH', url: `/api/v1/admin/championship-seasons/${seasonId}`, payload });
    expect(response.statusCode, response.body).toBe(400);
    const invariantPath = field === 'start_year' ? 'end_year' : field === 'starts_on' ? 'ends_on' : field;
    expect(response.json().issues.some((issue: { path: string[] }) => issue.path.includes(invariantPath))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith('update championship_seasons'))).toBe(false);
    await app.close();
  });

  it('returns 404 for an unknown Championship and 409 for a duplicate scoped key', async () => {
    clientQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const app = Fastify(); await app.register(championshipSeasonRoutes);
    const payload = { key: '2026', label: '2026' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/championships/unknown/seasons', payload })).statusCode).toBe(404);
    clientQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'f1' }] })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/championships/f1/seasons', payload })).statusCode).toBe(409);
    await app.close();
  });
});
