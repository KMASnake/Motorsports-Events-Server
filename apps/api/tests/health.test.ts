import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const originalMetadata = {
    APP_VERSION: process.env.APP_VERSION,
    GIT_SHA: process.env.GIT_SHA,
    BUILD_TIME: process.env.BUILD_TIME
  };

  beforeEach(() => {
    databaseHealth.mockReset().mockResolvedValue(true);
    process.env.APP_VERSION = 'f-test';
    process.env.GIT_SHA = 'abc123';
    process.env.BUILD_TIME = '2026-08-25T10:00:00Z';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalMetadata)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
    const ready = await app.inject('/health/ready');
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      version: 'f-test', git_sha: 'abc123', build_time: '2026-08-25T10:00:00Z'
    });
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
    expect(response.json()).toMatchObject({
      version: 'f-test', git_sha: 'abc123', build_time: '2026-08-25T10:00:00Z'
    });
    await app.close();
  });

  it('reports missing build metadata as unknown instead of inventing a release version', async () => {
    delete process.env.APP_VERSION;
    delete process.env.GIT_SHA;
    delete process.env.BUILD_TIME;
    const app = await application();
    expect((await app.inject('/health/live')).json()).toMatchObject({
      version: 'unknown', git_sha: 'unknown', build_time: 'unknown'
    });
    await app.close();
  });
});
