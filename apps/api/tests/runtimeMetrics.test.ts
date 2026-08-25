import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/db.js', () => ({ databaseHealth: vi.fn(async () => true) }));

import { databaseHealth } from '../src/lib/db.js';
import { registerRuntimeMetrics } from '../src/lib/runtimeMetrics.js';

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.mocked(databaseHealth).mockResolvedValue(true);
});

describe('runtime metrics', () => {
  it('exports bounded operational metrics without request data', async () => {
    const app = Fastify();
    apps.push(app);
    await registerRuntimeMetrics(app);
    app.get('/ok', async () => ({ authorization: 'must-not-be-exported' }));
    app.get('/limited', async (_request, reply) => reply.code(429).send());
    app.get('/error', async (_request, reply) => reply.code(503).send());

    await app.inject({ method: 'GET', url: '/ok', headers: { authorization: 'Bearer secret' } });
    await app.inject({ method: 'GET', url: '/limited' });
    await app.inject({ method: 'GET', url: '/error' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('motorsports_http_requests_total 3');
    expect(response.body).toContain('motorsports_http_server_errors_total 1');
    expect(response.body).toContain('motorsports_http_rate_limited_total 1');
    expect(response.body).toContain('motorsports_postgres_ready 1');
    expect(response.body).not.toContain('secret');
    expect(response.body).not.toContain('/ok');
  });
});
