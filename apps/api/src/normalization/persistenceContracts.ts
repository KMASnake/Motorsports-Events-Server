import type { PoolClient } from 'pg';

export type NormalizedResourceKind = 'event' | 'meeting';
export type NormalizationDecisionKind = 'linked' | 'rejected' | 'review' | 'create';

export interface NormalizedCandidateInput {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly sourceHash: string;
  readonly normalizationVersion: string;
  readonly resourceKind: NormalizedResourceKind;
  readonly candidateData: Readonly<Record<string, unknown>>;
}

export interface NormalizationDecisionInput {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly candidateId: string | null;
  readonly decision: NormalizationDecisionKind;
  readonly targetKind: NormalizedResourceKind | null;
  readonly targetId: string | null;
  readonly normalizationVersion: string;
  readonly actorId: string;
  readonly reason?: string | null;
}

export interface NormalizationCheckpointInput {
  readonly scopeKey: string;
  readonly normalizationVersion: string;
  readonly lastSourceEntityId: string | null;
  readonly lastSourceChangedAt: Date | null;
  readonly expectedFenceGeneration: number;
}

export interface NormalizationPersistenceRepository {
  insertCandidate(client: PoolClient, input: NormalizedCandidateInput): Promise<unknown>;
  findCandidate(client: PoolClient, id: string): Promise<unknown | null>;
  insertDecision(client: PoolClient, input: NormalizationDecisionInput): Promise<unknown>;
  readCheckpoint(client: PoolClient, scopeKey: string): Promise<unknown | null>;
  advanceCheckpoint(client: PoolClient, input: NormalizationCheckpointInput): Promise<unknown>;
}
