import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({
  pool: { query },
  withTransaction: vi.fn()
}));

import { championshipRoutes } from '../src/routes/championships.js';
import { eventRoutes } from '../src/routes/events.js';
import { sessionRoutes } from '../src/routes/sessions.js';
import { catalogRoutes } from '../src/routes/catalog.js';
import { registerAdminAuth, signAdminToken } from '../src/lib/adminAuth.js';
import { registerUuidParamValidation } from '../src/lib/routeParams.js';

const ID = '10000000-0000-4000-8000-000000000001';
const SECRET = 'public-api-security-secret-at-least-thirty-two-chars';
const admin = signAdminToken({ sub: 'security', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
const safeChampionship = { id: ID, slug: 'safe', name: 'Safe', short_name: null, official_name: null, category: null, season: 2026, logo_url: null, description: null, event_count: 1 };
const forbidden = /password|secret|token|api[_-]?key|master[_-]?key|ciphertext|nonce|key_version|provider_config|lease_owner|lease_generation|cursor|sync_state|sync_enabled|provider_key|external_id/i;

function assertNoLeak(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(assertNoLeak);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(key).not.toMatch(forbidden); assertNoLeak(child);
  }
}

async function app() {
  const instance = Fastify();
  registerUuidParamValidation(instance); registerAdminAuth(instance, SECRET);
  await instance.register(championshipRoutes); await instance.register(eventRoutes);
  await instance.register(sessionRoutes); await instance.register(catalogRoutes);
  return instance;
}

beforeEach(() => query.mockReset());

describe('public API security regression', () => {
  it('uses an explicit active-only public projection and a separate admin projection', async () => {
    query.mockImplementation(async (sql: string) => {
      sql = String(sql ?? '');
      if (sql.includes('c.active=true')) return { rowCount: 1, rows: [safeChampionship] };
      if (sql.includes('c.sync_enabled')) return { rowCount: 1, rows: [{ ...safeChampionship, active: false, sync_enabled: true, provider_key: 'INTERNAL_PROVIDER', external_id: 'INTERNAL_EXTERNAL' }] };
      return { rowCount: 0, rows: [] };
    });
    const instance = await app();
    const publicList = await instance.inject('/api/v1/championships');
    expect(publicList.statusCode).toBe(200); assertNoLeak(publicList.json());
    const publicSql = String(query.mock.calls[0][0]);
    expect(publicSql).toContain('c.active=true'); expect(publicSql).not.toContain('c.*');
    const adminList = await instance.inject({ url: '/api/v1/admin/championships', headers: { authorization: `Bearer ${admin}` } });
    expect(adminList.statusCode).toBe(200); expect(adminList.json()[0]).toMatchObject({ active: false, provider_key: 'INTERNAL_PROVIDER' });
    await instance.close();
  });

  it('returns 404 for a disabled championship by id', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });
    const instance = await app();
    const response = await instance.inject(`/api/v1/championships/${ID}`);
    expect(response.statusCode).toBe(404);
    expect(String(query.mock.calls[0][0])).toContain('c.active=true');
    await instance.close();
  });

  it('keeps public championship search parameterized', async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });
    const instance = await app();
    const search = `' OR 1=1 --`;
    const response = await instance.inject(`/api/v1/championships?search=${encodeURIComponent(search)}`);
    expect(response.statusCode).toBe(200);
    expect(String(query.mock.calls[0][0])).not.toContain(search);
    expect(query.mock.calls[0][1]).toEqual([`%${search}%`]);
    await instance.close();
  });

  it.each(['not-a-uuid', '123', '..%2F..%2Ffoo', '%27%20OR%201%3D1%20--'])('rejects invalid UUID %s before any database call', async (id) => {
    const instance = await app();
    const response = await instance.inject(`/api/v1/championships/${id}`);
    expect(response.statusCode).toBe(400); expect(query).not.toHaveBeenCalled();
    await instance.close();
  });

  it('recursively rejects forbidden keys across representative public resources', async () => {
    query.mockImplementation(async (sql: string) => {
      sql = String(sql ?? '');
      if (sql.includes('from championships c')) return { rowCount: 1, rows: [safeChampionship] };
      if (sql.includes('from events e')) return { rowCount: 1, rows: [{ id: ID, name: 'Event', championship_id: ID }] };
      if (sql.includes('from sessions s')) return { rowCount: 1, rows: [{ id: ID, event_id: ID, title: 'Race' }] };
      return { rowCount: 1, rows: [{ id: ID, name: 'Circuit' }] };
    });
    const instance = await app();
    for (const path of ['/api/v1/championships', '/api/v1/championships/' + ID, '/api/v1/events', '/api/v1/events/' + ID, '/api/v1/events/' + ID + '/sessions', '/api/v1/sessions/' + ID, '/api/v1/circuits']) {
      const response = await instance.inject(path); expect(response.statusCode, path).toBe(200); assertNoLeak(response.json());
    }
    await instance.close();
  });
});
