import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { catalogRoutes } from './routes/catalog.js';
import { championshipRoutes } from './routes/championships.js';
import { eventRoutes } from './routes/events.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.addHook('onRequest', async (request) => {
  const methodHasNoExpectedBody =
    request.method === 'DELETE' || request.method === 'GET' || request.method === 'HEAD';

  const contentLength = request.headers['content-length'];
  const transferEncoding = request.headers['transfer-encoding'];
  const hasNoBody =
    (contentLength === undefined || contentLength === '0') &&
    transferEncoding === undefined;

  if (methodHasNoExpectedBody && hasNoBody) {
    delete request.headers['content-type'];
  }
});

await app.register(healthRoutes);
await app.register(dashboardRoutes);
await app.register(catalogRoutes);
await app.register(championshipRoutes);
await app.register(eventRoutes);

const port = Number(process.env.API_PORT ?? 3001);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
