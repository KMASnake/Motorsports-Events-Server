import Fastify from 'fastify';
import { ReadableStream } from 'node:stream/web';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { registerSecurityHeaders, secureFastifyOptions, trustedProxyConfiguration } from '../src/lib/httpSecurity.js';
import { fetchProviderJson } from '../src/providers/providerHttp.js';
import { assertProviderConfigContainsNoSecrets, ProviderSecretCipher, redactProviderData } from '../src/providers/providerSecrets.js';
import { registerAdminAuth, signAdminToken } from '../src/lib/adminAuth.js';
import { championshipBody } from '../src/routes/championships.js';
import { adminEventQuery } from '../src/lib/adminQuery.js';

describe('pre-5.5 security baseline', () => {
  it('inventories mutations and keeps every sensitive route behind the global admin policy', () => {
    const routesDirectory = fileURLToPath(new URL('../src/routes/', import.meta.url));
    const mutations: string[] = [];
    for (const file of readdirSync(routesDirectory).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(`${routesDirectory}/${file}`, 'utf8');
      for (const match of source.matchAll(/app\.(?:post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) mutations.push(match[1]);
    }
    expect(mutations.length).toBeGreaterThan(20);
    const intentionallyPublicAuth = new Set(['/api/v1/auth/login', '/api/v1/auth/logout']);
    expect(mutations.filter((path) => !path.startsWith('/api/v1/admin/')
      && !path.startsWith('/api/v1/championships') && !intentionallyPublicAuth.has(path))).toEqual([]);
  });

  it('rejects missing, invalid, expired and viewer authentication globally', async () => {
    const secret = 'security-suite-secret-at-least-thirty-two-characters';
    const app = Fastify(); registerAdminAuth(app, secret);
    app.post('/api/v1/admin/security-probe', async () => ({ ok: true }));
    const token = (role: 'admin' | 'viewer', exp: number) => signAdminToken({ sub: 'probe', role, exp }, secret);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/security-probe' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/security-probe', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/security-probe', headers: { authorization: `Bearer ${token('admin', 1)}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/security-probe', headers: { authorization: `Bearer ${token('viewer', Math.floor(Date.now() / 1000) + 60)}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/security-probe', headers: { authorization: `Bearer ${token('admin', Math.floor(Date.now() / 1000) + 60)}` } })).statusCode).toBe(200);
    await app.close();
  });

  it('does not trust spoofed forwarding headers unless the proxy is explicitly allowed', async () => {
    const untrusted = Fastify({ trustProxy: trustedProxyConfiguration('') });
    untrusted.get('/ip', async (request) => ({ ip: request.ip }));
    expect((await untrusted.inject({ url: '/ip', headers: { 'x-forwarded-for': '203.0.113.66' } })).json().ip).toBe('127.0.0.1');
    await untrusted.close();

    const trusted = Fastify({ trustProxy: trustedProxyConfiguration('127.0.0.1') });
    trusted.get('/ip', async (request) => ({ ip: request.ip }));
    expect((await trusted.inject({ url: '/ip', headers: { 'x-forwarded-for': '203.0.113.66' } })).json().ip).toBe('203.0.113.66');
    await trusted.close();
    expect(() => trustedProxyConfiguration('*')).toThrow();
    expect(() => trustedProxyConfiguration('true')).toThrow();
  });

  it('sets global security headers, production HSTS and a bounded request body', async () => {
    const app = Fastify({ ...secureFastifyOptions({}), logger: false });
    registerSecurityHeaders(app, true);
    app.post('/body', async () => ({ ok: true }));
    const response = await app.inject({ method: 'POST', url: '/body', payload: { value: 'ok' } });
    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY', 'strict-transport-security': 'max-age=31536000; includeSubDomains'
    });
    expect(response.headers['content-security-policy']).not.toContain('unsafe-eval');
    const oversized = await app.inject({ method: 'POST', url: '/body', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ value: 'x'.repeat(1_100_000) }) });
    expect(oversized.statusCode).toBe(413);
    await app.close();
  });

  it.each([
    'http://localhost/private', 'https://127.0.0.1/private', 'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.1/private', 'https://user:password@api.ocblacktop.com/private',
    'https://api.ocblacktop.com.evil.example/private', 'https://evil-api.ocblacktop.com/private'
  ])('blocks unsafe provider target %s', async (target) => {
    await expect(fetchProviderJson({ url: new URL(target), allowedHosts: ['api.ocblacktop.com'], allowTestHttp: true, fetchImpl: vi.fn() })).rejects.toMatchObject({ code: 'unsafe_endpoint' });
  });

  it('disables redirects, requires JSON and bounds chunked responses before full buffering', async () => {
    const redirectFetch = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.redirect).toBe('error');
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    });
    await fetchProviderJson({ url: new URL('https://api.ocblacktop.com/test'), allowedHosts: ['api.ocblacktop.com'], fetchImpl: redirectFetch });
    await expect(fetchProviderJson({ url: new URL('https://api.ocblacktop.com/test'), allowedHosts: ['api.ocblacktop.com'], fetchImpl: async () => new Response('html', { headers: { 'content-type': 'text/html' } }) })).rejects.toMatchObject({ code: 'invalid_content_type' });

    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(6)); },
      cancel() { cancelled = true; }
    });
    await expect(fetchProviderJson({ url: new URL('https://api.ocblacktop.com/test'), allowedHosts: ['api.ocblacktop.com'], maxBytes: 10, fetchImpl: async () => new Response(body as unknown as BodyInit, { headers: { 'content-type': 'application/json' } }) })).rejects.toMatchObject({ code: 'response_too_large' });
    expect(cancelled).toBe(true);
  });

  it('redacts nested secrets and keeps provider encryption fail-closed and rotatable', () => {
    const sentinels = { nested: [{ authorization: 'SUPER_SECRET_TOKEN_ABCDE', safe: 'visible' }], password: 'SUPER_SECRET_PASSWORD_67890' };
    expect(JSON.stringify(redactProviderData(sentinels))).toBe('{"nested":[{"safe":"visible"}]}');
    expect(() => assertProviderConfigContainsNoSecrets({ nested: [{ api_key: 'SUPER_SECRET_API_KEY_12345' }] })).toThrow();
    expect(ProviderSecretCipher.fromEnvironment({})).toBeNull();
    const key1 = Buffer.alloc(32, 1); const key2 = Buffer.alloc(32, 2);
    const first = new ProviderSecretCipher(new Map([[1, key1]]), 1).encrypt('secret', 'provider', 'api_key');
    const rotated = new ProviderSecretCipher(new Map([[1, key1], [2, key2]]), 2);
    expect(rotated.decrypt(first, 'provider', 'api_key')).toBe('secret');
    expect(rotated.encrypt('new-secret', 'provider', 'api_key').keyVersion).toBe(2);
  });

  it('rejects mass assignment, unsafe displayed URLs and SQL control input', () => {
    const base = { name: "Formula ' OR 1=1 --", slug: 'formula-test', season: 2026 };
    expect(championshipBody.safeParse({ ...base, role: 'admin' }).success).toBe(false);
    expect(championshipBody.safeParse({ ...base, created_at: '2026-01-01' }).success).toBe(false);
    expect(championshipBody.safeParse({ ...base, logo_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(championshipBody.safeParse({ ...base, logo_url: 'https://cdn.example/logo.png' }).success).toBe(true);
    expect(adminEventQuery.safeParse({ sort: "'; DROP TABLE events; --" }).success).toBe(false);
    expect(adminEventQuery.safeParse({ search: "' OR 1=1 --" }).success).toBe(true);
  });
});
