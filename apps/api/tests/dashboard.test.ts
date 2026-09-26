import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({ pool: { query } }));

import { dashboardRoutes } from '../src/routes/dashboard.js';

describe('dashboard summary', () => {
  beforeEach(() => {
    query.mockReset()
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 4 }] });
  });

  it('returns only metrics computed from the database', async () => {
    const app = Fastify({ logger: false });
    await app.register(dashboardRoutes);
    const response = await app.inject('/api/v1/dashboard/summary');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ championships: 2, events: 3, circuits: 4 });
    expect(response.json()).not.toHaveProperty('synchronizationsToday');
    await app.close();
  });
});
