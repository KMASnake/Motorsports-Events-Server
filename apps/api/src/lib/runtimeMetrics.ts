import type { FastifyInstance } from 'fastify';
import { databaseHealth } from './db.js';

const startedAt = Date.now();
let requests = 0;
let serverErrors = 0;
let rateLimited = 0;
let durationSeconds = 0;

function metric(name: string, help: string, type: 'counter' | 'gauge', value: number): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`;
}

export async function registerRuntimeMetrics(app: FastifyInstance): Promise<void> {
  const requestStarts = new WeakMap<object, bigint>();
  app.addHook('onRequest', async (request) => {
    requestStarts.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, reply) => {
    if (request.url === '/metrics') return;
    requests += 1;
    if (reply.statusCode >= 500) serverErrors += 1;
    if (reply.statusCode === 429) rateLimited += 1;
    const value = requestStarts.get(request);
    if (value !== undefined) {
      durationSeconds += Number(process.hrtime.bigint() - value) / 1_000_000_000;
      requestStarts.delete(request);
    }
  });

  app.get('/metrics', async (_request, reply) => {
    const databaseReady = await databaseHealth();
    const body = [
      metric('motorsports_api_uptime_seconds', 'API process uptime.', 'gauge', (Date.now() - startedAt) / 1000),
      metric('motorsports_http_requests_total', 'Completed HTTP requests excluding metrics scrapes.', 'counter', requests),
      metric('motorsports_http_request_duration_seconds_sum', 'Cumulative HTTP request duration.', 'counter', durationSeconds),
      metric('motorsports_http_server_errors_total', 'Completed HTTP 5xx responses.', 'counter', serverErrors),
      metric('motorsports_http_rate_limited_total', 'Completed HTTP 429 responses.', 'counter', rateLimited),
      metric('motorsports_postgres_ready', 'Whether PostgreSQL is reachable by the API.', 'gauge', databaseReady ? 1 : 0)
    ].join('');
    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(body);
  });
}
