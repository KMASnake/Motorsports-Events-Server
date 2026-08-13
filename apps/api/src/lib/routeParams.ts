import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

export const uuid = z.string().uuid();

export function uuidParam<Key extends string>(key: Key, value: unknown): { [P in Key]: string } | null {
  const parsed = z.object({ [key]: uuid }).strict().safeParse(value);
  return parsed.success ? parsed.data as { [P in Key]: string } : null;
}

const UUID_ROUTE_PATTERNS = [
  /^\/api\/v1\/(?:admin\/)?championships\/:id$/,
  /^\/api\/v1\/admin\/(?:providers|provider-championships)\/:id(?:\/.*)?$/
];

export function registerUuidParamValidation(app: FastifyInstance): void {
  app.addHook('preValidation', async (request, reply) => {
    const route = request.routeOptions.url ?? '';
    if (!UUID_ROUTE_PATTERNS.some((pattern) => pattern.test(route))) return;
    const params = request.params as Record<string, unknown>;
    for (const name of ['id', 'eventId', 'discoveryId']) {
      if (params[name] !== undefined && !uuid.safeParse(params[name]).success) {
        return reply.code(400).send({ message: 'Identifiant invalide.' });
      }
    }
  });
}
