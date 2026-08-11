import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clearAdminCookies, parseCookies, setAdminCookies, type AdminCookieConfig } from '../lib/adminCookies.js';
import { constantTimeTokenEqual, createCsrfToken, loginAdministrator, logoutHumanSession, validateHumanSession, verifyCsrfToken } from '../lib/adminSession.js';

const loginBody = z.object({ username: z.string().min(1).max(128), password: z.string().min(1).max(1024) }).strict();
const response = (session: { username: string; idleExpiresAt: Date; absoluteExpiresAt: Date }) => ({
  authenticated: true,
  administrator: { username: session.username },
  idle_expires_at: session.idleExpiresAt.toISOString(),
  absolute_expires_at: session.absoluteExpiresAt.toISOString()
});

export type AuthRouteOptions = { cookie: AdminCookieConfig; sessionSecret: string; webOrigin: string };

export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  const allowedOrigin = (origin: string | undefined) => !origin || origin === options.webOrigin;
  app.post('/api/v1/auth/login', async (request, reply) => {
    if (!allowedOrigin(request.headers.origin)) return reply.code(403).send({ message: 'Origine non autorisée.' });
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Requête invalide.' });
    const result = await loginAdministrator({ ...parsed.data, requestId: request.id });
    if (result.status === 'uninitialized') return reply.code(503).send({ message: "Console d'administration non initialisée." });
    if (result.status === 'invalid') return reply.code(401).send({ message: 'Identifiant ou mot de passe incorrect.' });
    if (result.status === 'blocked') return reply.header('retry-after', result.retryAfterSeconds).code(429).send({ message: 'Connexion temporairement indisponible.' });
    const csrf = createCsrfToken(result.session.id, options.sessionSecret);
    setAdminCookies(reply, options.cookie, result.token, csrf);
    return response(result.session);
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    const token = parseCookies(request)[options.cookie.sessionName] ?? '';
    const session = await validateHumanSession(token);
    if (!session) {
      clearAdminCookies(reply, options.cookie);
      return reply.code(401).send({ message: 'Authentification requise.' });
    }
    return response(session);
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const cookies = parseCookies(request);
    const token = cookies[options.cookie.sessionName] ?? '';
    const session = await validateHumanSession(token);
    if (session) {
      const header = typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '';
      const csrf = cookies[options.cookie.csrfName] ?? '';
      if (request.headers.origin !== options.webOrigin || !header || !constantTimeTokenEqual(header, csrf) || !verifyCsrfToken(csrf, session.id, options.sessionSecret)) {
        return reply.code(403).send({ message: 'Protection CSRF invalide.' });
      }
      await logoutHumanSession(token, request.id);
    }
    clearAdminCookies(reply, options.cookie);
    return reply.code(204).send();
  });
}
