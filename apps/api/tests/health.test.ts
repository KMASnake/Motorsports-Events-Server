import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseHealth = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({ databaseHealth }));

import { healthRoutes } from '../src/routes/health.js';

async function application() {
  const app = Fastify({ logger: false });
  await app.register(healthRoutes);
  await app.ready();
  return app;
}

describe('health boundary', () => {
  beforeEach(() => {
    databaseHealth.mockReset().mockResolvedValue(true);
    process.env.APP_VERSION = 'f-test';
    process.env.GIT_SHA = 'abc123';
    process.env.BUILD_TIME = '2026-08-25T10:00:00Z';
  });

  it('keeps liveness independent from PostgreSQL and external providers', async () => {
    const app = await application();
    const response = await app.inject('/health/live');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok', version: 'f-test', git_sha: 'abc123', build_time: '2026-08-25T10:00:00Z'
    });
    expect(databaseHealth).not.toHaveBeenCalled();
    await app.close();
  });

  it('reports readiness only while the database/schema startup boundary remains serviceable', async () => {
    const app = await application();
    expect((await app.inject('/health/ready')).statusCode).toBe(200);
    databaseHealth.mockResolvedValue(false);
    const unavailable = await app.inject('/health/ready');
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json().status).toBe('degraded');
    await app.close();
  });

  it('preserves the legacy health response', async () => {
    const app = await application();
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json().checks).toEqual({ database: true });
    await app.close();
  });
});
