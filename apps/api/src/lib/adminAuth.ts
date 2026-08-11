import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseCookies, clearAdminCookies, type AdminCookieConfig } from './adminCookies.js';
import { constantTimeTokenEqual, validateHumanSession, verifyCsrfToken } from './adminSession.js';

const payloadSchema = z.object({ sub: z.string().min(1).max(160), role: z.enum(['admin', 'viewer']), exp: z.number().int().positive() }).strict();
export type AdminTokenPrincipal = z.infer<typeof payloadSchema>;
export type AdminPrincipal = AdminTokenPrincipal & { auth_method: 'technical_hmac' | 'human_session'; session_id?: string };
const encode = (value: string) => Buffer.from(value).toString('base64url');
const signature = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signAdminToken(principal: AdminTokenPrincipal, secret: string): string {
  const payload = encode(JSON.stringify(payloadSchema.parse(principal)));
  return `${payload}.${signature(payload, secret)}`;
}
export function verifyAdminToken(token: string, secret: string, now = Date.now()): AdminTokenPrincipal {
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra) throw new Error('invalid');
  const expected = Buffer.from(signature(payload, secret)); const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new Error('invalid');
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new Error('invalid'); }
  const principal = payloadSchema.parse(decoded);
  if (principal.exp * 1000 <= now) throw new Error('expired');
  return principal;
}
export type HumanAuthOptions = { cookie: AdminCookieConfig; sessionSecret: string; webOrigin: string };

export function registerAdminAuth(app: FastifyInstance, secret = process.env.ADMIN_AUTH_SECRET, human?: HumanAuthOptions): void {
  if (!secret || secret.length < 32) throw new Error('ADMIN_AUTH_SECRET doit contenir au moins 32 caractères.');
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?', 1)[0];
    const protectedAdminRoute = path.startsWith('/api/v1/admin/')
      || (path.startsWith('/api/v1/championships') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
    if (!protectedAdminRoute) return;
    const authorization = request.headers.authorization;
    if (authorization !== undefined) {
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
      let tokenPrincipal: AdminTokenPrincipal;
      try { tokenPrincipal = verifyAdminToken(token, secret); } catch { return reply.code(401).send({ message: 'Jeton invalide ou expiré.' }); }
      if (tokenPrincipal.role !== 'admin') return reply.code(403).send({ message: 'Droits administrateur requis.' });
      (request as FastifyRequest & { adminPrincipal?: AdminPrincipal }).adminPrincipal = { ...tokenPrincipal, auth_method: 'technical_hmac' };
      return;
    }
    if (!human) return reply.code(401).send({ message: 'Authentification requise.' });
    const cookies = parseCookies(request);
    const session = await validateHumanSession(cookies[human.cookie.sessionName] ?? '');
    if (!session) {
      clearAdminCookies(reply, human.cookie);
      return reply.code(401).send({ message: 'Authentification requise.' });
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      const header = typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '';
      const csrf = cookies[human.cookie.csrfName] ?? '';
      if (origin !== human.webOrigin || !header || !constantTimeTokenEqual(header, csrf) || !verifyCsrfToken(csrf, session.id, human.sessionSecret)) {
        return reply.code(403).send({ message: 'Protection CSRF invalide.' });
      }
    }
    (request as FastifyRequest & { adminPrincipal?: AdminPrincipal }).adminPrincipal = {
      sub: session.username,
      role: 'admin',
      exp: Math.floor(session.absoluteExpiresAt.getTime() / 1000),
      auth_method: 'human_session',
      session_id: session.id
    };
  });
}
