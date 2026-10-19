import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PostgresNormalizationPersistenceRepository } from '../src/normalization/postgresNormalizationPersistenceRepository.js';

const client=(rows:unknown[]=[{id:'row'}])=>({query:vi.fn().mockResolvedValue({rows})}) as unknown as PoolClient;

describe('Lot 5.7-P-A normalization persistence repository',()=>{
  it('persists bounded structured candidates with parameterized SQL',async()=>{
    const db=client(),repository=new PostgresNormalizationPersistenceRepository();
    await repository.insertCandidate(db,{id:'57000000-0000-4000-8000-000000000001',sourceEntityId:'57000000-0000-4000-8000-000000000002',sourceHash:'hash',normalizationVersion:'v1',resourceKind:'event',candidateData:{name:'Historic Race'}});
    const call=vi.mocked(db.query).mock.calls[0];
    expect(call[0]).toContain('$6::jsonb');
    expect(call[1]).toContain(JSON.stringify({name:'Historic Race'}));
  });

  it('refuses oversized candidate data before PostgreSQL',async()=>{
    const db=client(),repository=new PostgresNormalizationPersistenceRepository();
    await expect(repository.insertCandidate(db,{id:'id',sourceEntityId:'source',sourceHash:'hash',normalizationVersion:'v1',resourceKind:'event',candidateData:{value:'x'.repeat(65_536)}})).rejects.toThrow('normalized_candidate_data_invalid');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('persists decisions without producing them automatically',async()=>{
    const db=client(),repository=new PostgresNormalizationPersistenceRepository();
    await repository.insertDecision(db,{id:'id',sourceEntityId:'source',candidateId:null,decision:'create',targetKind:null,targetId:null,normalizationVersion:'v1',actorId:'administrator'});
    expect(db.query).toHaveBeenCalledOnce();
  });

  it('rejects stale or non-monotone checkpoint writes',async()=>{
    const db=client([]),repository=new PostgresNormalizationPersistenceRepository();
    await expect(repository.advanceCheckpoint(db,{scopeKey:'f1',normalizationVersion:'v1',lastSourceEntityId:null,lastSourceChangedAt:new Date('1965-01-01T00:00:00Z'),expectedFenceGeneration:3})).rejects.toThrow('normalization_checkpoint_stale');
  });
});
