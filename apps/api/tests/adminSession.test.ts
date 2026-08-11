import { describe, expect, it } from 'vitest';
import { constantTimeTokenEqual, createCsrfToken, verifyCsrfToken } from '../src/lib/adminSession.js';
import { adminCookieConfig, parseCookies, setAdminCookies } from '../src/lib/adminCookies.js';

describe('human administrator session primitives', () => {
  it('binds a signed CSRF token to one server session', () => {
    const secret = 'test-session-secret-with-thirty-two-characters';
    const token = createCsrfToken('session-a', secret);
    expect(verifyCsrfToken(token, 'session-a', secret)).toBe(true);
    expect(verifyCsrfToken(token, 'session-b', secret)).toBe(false);
    expect(verifyCsrfToken(`${token}x`, 'session-a', secret)).toBe(false);
    expect(constantTimeTokenEqual(token, token)).toBe(true);
    expect(constantTimeTokenEqual(token, `${token}x`)).toBe(false);
  });

  it('uses a distinct secure __Host cookie name in secure mode', () => {
    const oldSecure = process.env.ADMIN_COOKIE_SECURE;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_COOKIE_SECURE = 'true';
    expect(adminCookieConfig().sessionName).toBe('__Host-mse_admin_session');
    if (oldSecure === undefined) delete process.env.ADMIN_COOKIE_SECURE; else process.env.ADMIN_COOKIE_SECURE = oldSecure;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
  });

  it('refuses an insecure production cookie configuration', () => {
    const oldSecure = process.env.ADMIN_COOKIE_SECURE;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_COOKIE_SECURE = 'false';
    expect(() => adminCookieConfig()).toThrow('ADMIN_COOKIE_SECURE=true');
    if (oldSecure === undefined) delete process.env.ADMIN_COOKIE_SECURE; else process.env.ADMIN_COOKIE_SECURE = oldSecure;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
  });

  it('parses cookies without throwing on invalid encoding', () => {
    const request = { headers: { cookie: 'valid=value; broken=%ZZ' } } as never;
    expect(parseCookies(request)).toEqual({ valid: 'value' });
  });

  it('sets production session and CSRF cookies with the required attributes', () => {
    let header: unknown;
    const reply = { header(_name: string, value: unknown) { header = value; } } as never;
    const config = { secure: true, sessionName: '__Host-mse_admin_session', csrfName: '__Host-mse_admin_csrf' };
    setAdminCookies(reply, config, 'opaque-session', 'signed-csrf');
    const cookies = header as string[];
    expect(cookies[0]).toContain('__Host-mse_admin_session=opaque-session');
    expect(cookies[0]).toContain('; HttpOnly');
    expect(cookies[0]).toContain('; Secure');
    expect(cookies[0]).toContain('; SameSite=Lax');
    expect(cookies[0]).toContain('; Path=/');
    expect(cookies[0]).not.toContain('Domain=');
    expect(cookies[1]).not.toContain('HttpOnly');
    expect(cookies[1]).toContain('; Secure');
  });
});
