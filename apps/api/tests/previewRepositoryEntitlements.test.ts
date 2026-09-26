import { describe, expect, it, vi } from 'vitest';
import { PostgresPreviewRepository } from '../src/preview/repository.js';

describe('5.7-P-E canonical championship entitlement SQL', () => {
  it('filters collections and changes with text arrays only', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = new PostgresPreviewRepository({ query } as never);

    await repository.list({
      resourceType: 'championship',
      limit: 50,
      snapshotSequence: 1,
      allowedChampionshipIds: ['f1']
    });
    await repository.changes(0, 100, false, ['f1']);

    const collectionSql = String(query.mock.calls[0][0]);
    const changesSql = String(query.mock.calls[1][0]);
    expect(collectionSql).toContain('s.championship_id=any($3::text[])');
    expect(changesSql).toContain('v.championship_id=any($3::text[])');
    expect(`${collectionSql}\n${changesSql}`).not.toContain('uuid[]');
    expect(query.mock.calls[0][1]).toContainEqual(['f1']);
    expect(query.mock.calls[1][1]).toContainEqual(['f1']);
  });
});
