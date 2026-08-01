import type { FastifyInstance } from 'fastify';
import { pool } from '../lib/db.js';

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/circuits', async () => (await pool.query('select * from circuits order by country_code,name')).rows);
}
