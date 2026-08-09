import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAdminAuth, signAdminToken, verifyAdminToken } from '../src/lib/adminAuth.js';

const secret = 'test-secret-with-at-least-thirty-two-characters';
const future = Math.floor(Date.now() / 1000) + 3600;
const admin = signAdminToken({ sub: 'admin-test', role: 'admin', exp: future }, secret);
const viewer = signAdminToken({ sub: 'viewer-test', role: 'viewer', exp: future }, secret);
const expired = signAdminToken({ sub: 'expired-test', role: 'admin', exp: 1 }, secret);

async function securedApp() {
  const app = Fastify(); registerAdminAuth(app, secret);
  for (const path of ['/api/v1/admin/events', '/api/v1/admin/provider-events', '/api/v1/admin/corrections']) app.get(path, async () => ({ ok: true }));
  app.get('/api/v1/events', async () => ({ public: true }));
  app.get('/api/v1/championships', async () => ({ public: true }));
  app.post('/api/v1/championships', async () => ({ ok: true }));
  return app;
}

describe('administrative route authentication', () => {
  it.each(['/api/v1/admin/events', '/api/v1/admin/provider-events', '/api/v1/admin/corrections'])(
    'returns 401 without authentication for %s', async (url) => {
      const app = await securedApp(); expect((await app.inject({ url })).statusCode).toBe(401); await app.close();
    }
  );
  it('returns 401 for invalid and expired tokens', async () => {
    const app = await securedApp();
    expect((await app.inject({ url: '/api/v1/admin/events', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/admin/events', headers: { authorization: `Bearer ${expired}` } })).statusCode).toBe(401);
    await app.close();
  });
  it('returns 403 for an authenticated non-admin', async () => {
    const app = await securedApp();
    expect((await app.inject({ url: '/api/v1/admin/events', headers: { authorization: `Bearer ${viewer}` } })).statusCode).toBe(403); await app.close();
  });
  it('allows an administrator and keeps public routes public', async () => {
    const app = await securedApp();
    expect((await app.inject({ url: '/api/v1/admin/events', headers: { authorization: `Bearer ${admin}` } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/events' })).statusCode).toBe(200); await app.close();
  });
  it('protects legacy championship mutations but not their public read', async () => {
    const app = await securedApp();
    expect((await app.inject({ method: 'POST', url: '/api/v1/championships' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/championships', headers: { authorization: `Bearer ${viewer}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/championships', headers: { authorization: `Bearer ${admin}` } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/championships' })).statusCode).toBe(200); await app.close();
  });
  it('rejects signature tampering', () => expect(() => verifyAdminToken(`${admin}x`, secret)).toThrow());
});
