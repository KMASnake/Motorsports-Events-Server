import type { FastifyReply, FastifyRequest } from 'fastify';

export type AdminCookieConfig = {
  secure: boolean;
  sessionName: string;
  csrfName: string;
};

export function adminCookieConfig(): AdminCookieConfig {
  const secure = process.env.ADMIN_COOKIE_SECURE === 'true';
  if (process.env.NODE_ENV === 'production' && !secure) {
    throw new Error('ADMIN_COOKIE_SECURE=true is required in production.');
  }
  return {
    secure,
    sessionName: secure ? '__Host-mse_admin_session' : 'mse_admin_session',
    csrfName: secure ? '__Host-mse_admin_csrf' : 'mse_admin_csrf'
  };
}

export function parseCookies(request: FastifyRequest): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(header.split(';').flatMap((item) => {
    const separator = item.indexOf('=');
    if (separator < 1) return [];
    try { return [[item.slice(0, separator).trim(), decodeURIComponent(item.slice(separator + 1).trim())]]; }
    catch { return []; }
  }));
}

const serialize = (name: string, value: string, config: AdminCookieConfig, httpOnly: boolean, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${config.secure ? '; Secure' : ''}`;

export function setAdminCookies(reply: FastifyReply, config: AdminCookieConfig, sessionToken: string, csrfToken: string): void {
  reply.header('set-cookie', [
    serialize(config.sessionName, sessionToken, config, true, 28_800),
    serialize(config.csrfName, csrfToken, config, false, 28_800)
  ]);
}

export function clearAdminCookies(reply: FastifyReply, config: AdminCookieConfig): void {
  reply.header('set-cookie', [
    serialize(config.sessionName, '', config, true, 0),
    serialize(config.csrfName, '', config, false, 0)
  ]);
}
