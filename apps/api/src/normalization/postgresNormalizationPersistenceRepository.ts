import type { PoolClient } from 'pg';
import type {
  NormalizationCheckpointInput,
  NormalizationDecisionInput,
  NormalizationPersistenceRepository,
  NormalizedCandidateInput
} from './persistenceContracts.js';

const MAX_CANDIDATE_BYTES = 65_536;

function assertCandidateData(value: Readonly<Record<string, unknown>>): void {
  if (Array.isArray(value) || value === null || Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_CANDIDATE_BYTES) {
    throw new Error('normalized_candidate_data_invalid');
  }
}

export class PostgresNormalizationPersistenceRepository implements NormalizationPersistenceRepository {
  async insertCandidate(client: PoolClient, input: NormalizedCandidateInput): Promise<unknown> {
    assertCandidateData(input.candidateData);
    return (await client.query(
      `insert into normalized_candidates(
         id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data
       ) values($1,$2,$3,$4,$5,$6::jsonb) returning *`,
      [input.id,input.sourceEntityId,input.sourceHash,input.normalizationVersion,input.resourceKind,JSON.stringify(input.candidateData)]
    )).rows[0];
  }

  async findCandidate(client: PoolClient, id: string): Promise<unknown | null> {
    return (await client.query('select * from normalized_candidates where id=$1',[id])).rows[0] ?? null;
  }

  async insertDecision(client: PoolClient, input: NormalizationDecisionInput): Promise<unknown> {
    return (await client.query(
      `insert into normalization_decisions(
         id,source_entity_id,candidate_id,decision,target_kind,target_id,
         normalization_version,actor_id,reason
       ) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [input.id,input.sourceEntityId,input.candidateId,input.decision,input.targetKind,input.targetId,input.normalizationVersion,input.actorId,input.reason ?? null]
    )).rows[0];
  }

  async readCheckpoint(client: PoolClient, scopeKey: string): Promise<unknown | null> {
    return (await client.query('select * from normalization_checkpoints where scope_key=$1',[scopeKey])).rows[0] ?? null;
  }

  async advanceCheckpoint(client: PoolClient, input: NormalizationCheckpointInput): Promise<unknown> {
    const row=(await client.query(
      `insert into normalization_checkpoints(
         scope_key,normalization_version,last_source_entity_id,last_source_changed_at,fence_generation
       ) values($1,$2,$3,$4,$5)
       on conflict(scope_key) do update set
         normalization_version=excluded.normalization_version,
         last_source_entity_id=excluded.last_source_entity_id,
         last_source_changed_at=excluded.last_source_changed_at,
         fence_generation=excluded.fence_generation,
         revision=normalization_checkpoints.revision+1,
         updated_at=now()
       where normalization_checkpoints.fence_generation=$5
         and ((excluded.last_source_changed_at is null
               and normalization_checkpoints.last_source_changed_at is null)
              or (excluded.last_source_changed_at is not null
                  and (normalization_checkpoints.last_source_changed_at is null
                       or excluded.last_source_changed_at>=normalization_checkpoints.last_source_changed_at)))
       returning *`,
      [input.scopeKey,input.normalizationVersion,input.lastSourceEntityId,input.lastSourceChangedAt,input.expectedFenceGeneration]
    )).rows[0];
    if(!row) throw new Error('normalization_checkpoint_stale');
    return row;
  }
}
