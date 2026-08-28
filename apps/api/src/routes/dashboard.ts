import type { FastifyInstance } from 'fastify';
import { pool } from '../lib/db.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/dashboard/summary', async () => {
    const [championships, events, circuits] = await Promise.all([
      pool.query('select count(*)::int as count from championships'),
      pool.query('select count(*)::int as count from events'),
      pool.query('select count(*)::int as count from circuits')
    ]);

    return {
      championships: championships.rows[0].count,
      events: events.rows[0].count,
      circuits: circuits.rows[0].count
    };
  });
}
