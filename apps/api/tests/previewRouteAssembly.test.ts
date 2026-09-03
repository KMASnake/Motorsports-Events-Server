import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { PreviewClientSecurityService } from '../src/preview/clientSecurity.js';
import type { PreviewRepository } from '../src/preview/repository.js';

const query = vi.hoisted(() => vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }));
vi.mock('../src/lib/db.js', () => ({
  pool: { query },
  withTransaction: vi.fn()
}));

import { registerAdminAuth } from '../src/lib/adminAuth.js';
import { previewAwareResourceRoutes } from '../src/routes/previewAwareResources.js';

const ADMIN_SECRET = 'admin-route-assembly-secret-at-least-32-characters';
const CURSOR_SECRET = 'preview-route-assembly-secret-at-least-32-characters';

const security = {
  verify: vi.fn().mockResolvedValue(null),
  charge: vi.fn(),
  refundDaily: vi.fn()
} as unknown as PreviewClientSecurityService;

const repository = {
  snapshotBoundary: vi.fn(),
  oldestSnapshotSequence: vi.fn(),
  oldestChangeSequence: vi.fn(),
  resolveChampionship: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  changes: vi.fn()
} as unknown as PreviewRepository;

async function application(previewEnabled: boolean) {
  const app = Fastify({ logger: false });
  registerAdminAuth(app, ADMIN_SECRET);
  await app.register(previewAwareResourceRoutes, {
    previewEnabled,
    security,
    cursorSecret: CURSOR_SECRET,
    repository
  });
  await app.ready();
  return app;
}

describe('server Preview route assembly', () => {
  it('keeps the historical read handlers when Preview is disabled', async () => {
    const app = await application(false);

    expect((await app.inject('/api/v1/events')).statusCode).toBe(200);
    expect((await app.inject('/api/v1/championships')).statusCode).toBe(200);
    expect(app.hasRoute({ method: 'GET', url: '/api/v1/meetings' })).toBe(false);
    expect(app.hasRoute({ method: 'GET', url: '/api/v1/changes' })).toBe(false);
    expect((await app.inject('/api/v1/admin/events')).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/championships' })).statusCode).toBe(401);

    await app.close();
  });

  it('replaces only colliding reads with protected definitive Preview routes', async () => {
    const app = await application(true);

    for (const route of [
      '/api/v1/events',
      '/api/v1/events/57000000-0000-4000-8000-000000000001',
      '/api/v1/championships',
      '/api/v1/championships/57000000-0000-4000-8000-000000000001',
      '/api/v1/meetings',
      '/api/v1/meetings/57000000-0000-4000-8000-000000000001',
      '/api/v1/changes'
    ]) {
      const response = await app.inject(route);
      expect(response.statusCode, route).toBe(401);
      expect(response.json().error.code, route).toBe('invalid_api_key');
    }

    expect((await app.inject('/api/v1/admin/events')).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/championships' })).statusCode).toBe(401);
    expect(app.printRoutes()).not.toContain('/preview');

    await app.close();
  });
});
