import type { FastifyInstance } from 'fastify';
import { databaseHealth } from '../lib/db.js';

const service = 'motorsports-events-api';
function runtimeMetadata() {
  return {
    service,
    version: process.env.APP_VERSION ?? '8.1.0-alpha.2-lot.4.4',
    git_sha: process.env.GIT_SHA ?? 'unknown',
    build_time: process.env.BUILD_TIME ?? 'unknown'
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/live', async (_request, reply) => reply.code(200).send({
    status: 'ok',
    ...runtimeMetadata(),
    timestamp: new Date().toISOString()
  }));

  app.get('/health/ready', async (_request, reply) => {
    const ready = await databaseHealth();
    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'degraded',
      ...runtimeMetadata(),
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health', async (_request, reply) => {
    const database = await databaseHealth();
    const status = database ? 'ok' : 'degraded';
    return reply.code(database ? 200 : 503).send({
      status,
      ...runtimeMetadata(),
      timestamp: new Date().toISOString(),
      checks: { database }
    });
  });
}
