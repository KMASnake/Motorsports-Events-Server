import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const payloadSchema = z.object({ sub: z.string().min(1).max(160), role: z.enum(['admin', 'viewer']), exp: z.number().int().positive() }).strict();
export type AdminPrincipal = z.infer<typeof payloadSchema>;
const encode = (value: string) => Buffer.from(value).toString('base64url');
const signature = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signAdminToken(principal: AdminPrincipal, secret: string): string {
  const payload = encode(JSON.stringify(payloadSchema.parse(principal)));
  return `${payload}.${signature(payload, secret)}`;
}
export function verifyAdminToken(token: string, secret: string, now = Date.now()): AdminPrincipal {
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
export function registerAdminAuth(app: FastifyInstance, secret = process.env.ADMIN_AUTH_SECRET): void {
  if (!secret || secret.length < 32) throw new Error('ADMIN_AUTH_SECRET doit contenir au moins 32 caractères.');
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?', 1)[0];
    const protectedAdminRoute = path.startsWith('/api/v1/admin/')
      || (path.startsWith('/api/v1/championships') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
    if (!protectedAdminRoute) return;
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return reply.code(401).send({ message: 'Authentification requise.' });
    let principal: AdminPrincipal;
    try { principal = verifyAdminToken(token, secret); } catch { return reply.code(401).send({ message: 'Jeton invalide ou expiré.' }); }
    if (principal.role !== 'admin') return reply.code(403).send({ message: 'Droits administrateur requis.' });
  });
}
