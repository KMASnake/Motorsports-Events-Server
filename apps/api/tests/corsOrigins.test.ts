import cors from '@fastify/cors';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { corsAllowedOrigins } from '../src/lib/corsOrigins.js';

async function application(origins: readonly string[]) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: [...origins], credentials: true });
  app.get('/probe', async () => ({ ok: true }));
  return app;
}

describe('CORS origins', () => {
  it('accepts the explicitly configured preproduction origin with credentials', async () => {
    const origins = corsAllowedOrigins({
      CORS_ALLOWED_ORIGINS: 'https://preprod.motorsports-events.fr'
    });
    const app = await application(origins);
    const response = await app.inject({
      method: 'OPTIONS', url: '/probe',
      headers: { origin: origins[0], 'access-control-request-method': 'GET' }
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origins[0]);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    await app.close();
  });

  it('does not grant CORS to a foreign origin', async () => {
    const app = await application(['https://preprod.motorsports-events.fr']);
    const response = await app.inject({
      method: 'OPTIONS', url: '/probe',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' }
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('preserves both intended local development origins by default', () => {
    expect(corsAllowedOrigins({})).toEqual([
      'http://localhost:3000', 'http://127.0.0.1:3000'
    ]);
  });
});
