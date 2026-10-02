import { createHash } from 'node:crypto';
import {reconciliationFieldContract} from './reconciliationFieldContract.js';

export type ResourceKind = 'meeting' | 'event';
export type FieldClass = 'IDENTITY' | 'STRUCTURAL' | 'SCHEDULE' | 'STATUS' | 'DISPLAY' | 'REFERENCE';
export type Contribution = {
  id: string;
  providerKey: string;
  values: Record<string, unknown>;
  structuralReferences: Record<string, string | null>;
  eligible: boolean;
  withdrawn: boolean;
  sourceUpdatedAt?: string | null;
};
export type FieldRule = {
  field: string;
  class: FieldClass;
  providerPriority: readonly (readonly string[])[];
  scheduleToleranceSeconds?: number;
  staleAfterSeconds?: number;
  compatibleStatusTransitions?: Readonly<Record<string, readonly string[]>>;
};
export type Policy = { id: string; version: number; resourceKind: ResourceKind; rules: readonly FieldRule[] };
export type CanonicalOverride = { field: string; value: unknown; revision: number };
export type FieldDecision = {
  field: string;
  outcome: 'selected' | 'override' | 'auto_resolved' | 'review_required' | 'degraded';
  value?: unknown;
  winnerContributionId?: string;
  conflict?: { severity: 'warning' | 'critical'; reason: string; contributionIds: string[] };
};
export type ReconciliationInput = {
  resourceKind: ResourceKind;
  currentState: Record<string, unknown>;
  contributions: readonly Contribution[];
  policy: Policy;
  overrides: readonly CanonicalOverride[];
  evaluationAt: string;
};
export type ReconciliationOutput = {
  effectiveState: Record<string, unknown>;
  decisions: FieldDecision[];
  materializationEligible: boolean;
  contributionSetChecksum: string;
  overrideSetChecksum: string;
  effectiveChecksum: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function reconciliationChecksum(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}
function same(a: unknown, b: unknown): boolean { return stable(a) === stable(b); }

export const reconcilableFields:Readonly<Record<ResourceKind,ReadonlySet<string>>>={
  meeting:new Set(Object.keys(reconciliationFieldContract.meeting)),
  event:new Set(Object.keys(reconciliationFieldContract.event))
};
export const isReconcilableField=(kind:ResourceKind,field:string)=>reconcilableFields[kind].has(field);

function ranked(rule: FieldRule, contributions: readonly Contribution[], evaluationAt:string) {
  const evaluationTime=Date.parse(evaluationAt),withValues = contributions.filter(item => item.eligible && !item.withdrawn && item.values[rule.field] != null && (rule.staleAfterSeconds===undefined || (item.sourceUpdatedAt!=null && Number.isFinite(Date.parse(item.sourceUpdatedAt)) && evaluationTime-Date.parse(item.sourceUpdatedAt)<=rule.staleAfterSeconds*1000)));
  for (const rank of rule.providerPriority) {
    const candidates = withValues.filter(item => rank.includes(item.providerKey)).sort((a,b)=>a.id.localeCompare(b.id));
    if (candidates.length) return candidates;
  }
  return [];
}

function choose(rule: FieldRule, candidates: Contribution[]): FieldDecision {
  if (!candidates.length) return { field: rule.field, outcome: 'degraded' };
  const first = candidates[0]!;
  if (candidates.every(item => same(item.values[rule.field], first.values[rule.field]))) {
    return { field: rule.field, outcome: candidates.length > 1 ? 'auto_resolved' : 'selected', value: first.values[rule.field], winnerContributionId: first.id };
  }
  if (rule.class === 'SCHEDULE' && rule.scheduleToleranceSeconds !== undefined) {
    const instants = candidates.map(item => Date.parse(String(item.values[rule.field])));
    if (instants.every(Number.isFinite) && Math.max(...instants)-Math.min(...instants) <= rule.scheduleToleranceSeconds*1000) {
      return { field: rule.field, outcome: 'auto_resolved', value: first.values[rule.field], winnerContributionId: first.id };
    }
  }
  if (rule.class === 'STATUS' && rule.compatibleStatusTransitions) {
    const statuses = candidates.map(item=>String(item.values[rule.field]));
    const winner = statuses.find(status=>statuses.every(other=>status===other || rule.compatibleStatusTransitions?.[other]?.includes(status)));
    if (winner) {
      const item=candidates.find(candidate=>candidate.values[rule.field]===winner)!;
      return { field:rule.field,outcome:'auto_resolved',value:winner,winnerContributionId:item.id };
    }
  }
  return { field:rule.field,outcome:'review_required',conflict:{severity:'critical',reason:`equal-rank ${rule.class.toLowerCase()} disagreement`,contributionIds:candidates.map(item=>item.id).sort()} };
}

export function reconcile(input: ReconciliationInput): ReconciliationOutput {
  if (input.policy.resourceKind !== input.resourceKind) throw new Error('policy_resource_kind_mismatch');
  if (!Number.isFinite(Date.parse(input.evaluationAt))) throw new Error('invalid_evaluation_at');
  const contributions=[...input.contributions].sort((a,b)=>a.id.localeCompare(b.id));
  const overrideMap=new Map(input.overrides.map(item=>[item.field,item]));
  const effective={...input.currentState}; const decisions:FieldDecision[]=[];
  for (const rule of [...input.policy.rules].sort((a,b)=>a.field.localeCompare(b.field))) {
    if (rule.class==='IDENTITY' || !isReconcilableField(input.resourceKind,rule.field)) throw new Error(`non_reconcilable_field:${rule.field}`);
    const override=overrideMap.get(rule.field);
    if (override) { effective[rule.field]=override.value; decisions.push({field:rule.field,outcome:'override',value:override.value}); continue; }
    const decision=choose(rule,ranked(rule,contributions,input.evaluationAt)); decisions.push(decision);
    if (decision.value !== undefined) effective[rule.field]=decision.value;
  }
  const critical=decisions.some(item=>item.conflict?.severity==='critical');
  return {
    effectiveState: critical ? {...input.currentState} : effective,
    decisions,
    materializationEligible:!critical,
    contributionSetChecksum:reconciliationChecksum(contributions),
    overrideSetChecksum:reconciliationChecksum([...input.overrides].sort((a,b)=>a.field.localeCompare(b.field))),
    effectiveChecksum:reconciliationChecksum(critical ? input.currentState : effective)
  };
}
