import type { FastifyInstance } from 'fastify';
import { databaseHealth } from '../lib/db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const database = await databaseHealth();
    const status = database ? 'ok' : 'degraded';
    return reply.code(database ? 200 : 503).send({
      status,
      service: 'motorsports-events-api',
      version: '8.1.0-alpha.2-lot.4',
      timestamp: new Date().toISOString(),
      checks: { database }
    });
  });
}
