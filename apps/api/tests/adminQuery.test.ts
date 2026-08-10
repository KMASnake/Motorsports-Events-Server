import { describe, expect, it } from 'vitest';
import { adminEventQuery, correctionQuery, paginated, publicEventQuery } from '../src/lib/adminQuery.js';

describe('validated server pagination queries', () => {
  it('coerces bounded event pagination and validates sorting', () => {
    expect(adminEventQuery.parse({ page: '2', page_size: '25', sort: 'name', direction: 'desc' }))
      .toMatchObject({ page: 2, page_size: 25, sort: 'name', direction: 'desc' });
    expect(adminEventQuery.safeParse({ page: 0 }).success).toBe(false);
    expect(adminEventQuery.safeParse({ page_size: 101 }).success).toBe(false);
    expect(adminEventQuery.safeParse({ sort: 'drop table events' }).success).toBe(false);
  });
  it('rejects unknown, invalid public and correction filters', () => {
    expect(publicEventQuery.safeParse({ status: 'unknown' }).success).toBe(false);
    expect(publicEventQuery.safeParse({ unexpected: 'value' }).success).toBe(false);
    expect(correctionQuery.safeParse({ conflict: 'maybe' }).success).toBe(false);
    expect(correctionQuery.safeParse({ field: 'timezone' }).success).toBe(false);
  });
  it('returns stable pagination metadata', () => {
    expect(paginated(['row'], 51, 2, 25)).toEqual({ items: ['row'], pagination: { page: 2, page_size: 25, total: 51, pages: 3 } });
  });
});
