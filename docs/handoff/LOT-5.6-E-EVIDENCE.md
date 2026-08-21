# Lot 5.6-E — Implementation evidence for maintainer audit

Audit date: 2026-08-21

Audited branch: `codex/lot-5-providers-sync`

Implementation start (exclusive): `b7a31471efe99e1e86e6b163fed9f0d1d00a24ae`

Implementation final / audited SHA: `75b0fdf7d59d81c1e3e4f33d0391d525767629a8`

Implementation commit: `75b0fdf7d59d81c1e3e4f33d0391d525767629a8 feat(providers): implement Lot 5.6-E temporality and finalization`

This document records implementation evidence only. It does not validate Lot 5.6-E, authorize Lot 5.6-F, validate Lot 5.6 globally, authorize 5.7+, or authorize a merge to `main`.

## Governance state checked

- Current state: `sub-lot-5.6-e-implemented-awaiting-maintainer-audit`.
- Lot 5.6-E maintainer validation: `false`.
- Authorized technical sub-lot: none; Lot 5.6-F is not started or authorized.
- Lot 5.6 global maintainer validation: `false`.
- Lot 5.7, 5.7-P and 5.8+: unauthorized.
- Merge authorization: `false`.

## Git inventory

The implementation commit contains 15 files.

### Functional code

- `apps/api/src/providers/acquisitionOrchestrator.ts`: civil-time conversion, current/future classification, theoretical-end hierarchy and trace, durable finalization traversal, exact J+30 eligibility, anomaly lifecycle, and transactional integration after persistence.

### Migrations

- `infra/postgres/migrations/0022_lot56_temporality_finalization.up.sql`: adds and constrains the persisted estimation trace.
- `infra/postgres/migrations/0022_lot56_temporality_finalization.down.sql`: removes the trace column and migration registration.

### Tests and validators

- `apps/api/tests/acquisitionOrchestrator.test.ts`: focused unit coverage for priority, hierarchy, UTC/DST/calendar edges and timezone independence.
- `scripts/test-lot56-temporality.sh`: isolated real-PostgreSQL recipe for Lot 5.6-E.
- `scripts/validate-lot56-temporality.mjs`: real-PostgreSQL fixtures and assertions for J+30, statuses, trace, idempotence and replay.
- `scripts/validate-lot56-orchestration.mjs`: extends real-PostgreSQL orchestration regression coverage.
- `scripts/test-lot54-scheduler.sh` and `scripts/validate-lot54-audit.mjs`: keep scheduler regression checks aligned with the current schema.

### Governance and handoff documents

- `CHANGELOG.md`, `NEXT_STEPS.md`, `PROJECT-STATUS.json`, `PROJECT_STATUS.md`, `docs/handoff/PROGRESS.json`, and `docs/handoff/LOT-5.6-E-VALIDATION.md`: record scope, state, validation commands and handoff information.

## Migration 0022

Up migration: `infra/postgres/migrations/0022_lot56_temporality_finalization.up.sql`.

- Target table: `provider_source_entities`.
- Added column: `end_estimation_details jsonb NOT NULL DEFAULT '{}'::jsonb`.
- Constraints require a JSON object and limit its serialized size to 8192 bytes.
- No table or index is added.
- The value persists the selected method, provenance inputs, comparable sample or adapter/civil rule, duration, timezone and `logic_version` (`lot56-e-v1`).
- The migration registers version `0022_lot56_temporality_finalization` in `schema_migrations` with conflict-safe insertion. Normal idempotence is supplied by the versioned migration runner; the raw `ALTER TABLE ... ADD COLUMN` is not intended for manual replay outside that runner.
- The down migration drops the column and deletes the matching migration version.
- Migration 0021 remains responsible for the durable finalization queue/cursor; 0022 adds the audit trace required by 5.6-E.

## Implementation evidence

`acquisitionOrchestrator.ts` implements the end-time hierarchy in `estimateTheoreticalEnd`: provider end, last session end, median of at least three recent comparable durations, adapter duration rule, then civil-day fallback. `recentComparableDurations` sorts peers newest first and limits the sample to five. `refreshTheoreticalEndsClient` scopes peers to the provider championship and compatible entity kind/type, then persists `theoretical_end_at`, `end_estimated`, `end_provenance` and the structured details.

The J+30 gate is an exact UTC elapsed-duration comparison (`graceDays * 86400000`) in `finalizationDeadline`/`isFinalizationEligible`. Reliable final states are `completed`, `finished`, `final`, `cancelled` and `canceled`; postponed remains non-final. `evaluateFinalizationClient` creates one active anomaly using the durable unique key, attaches the source entity and deadline details, resolves it when the entity becomes final or is no longer overdue, and updates the durable check state. `afterPersist` runs classification, theoretical-end refresh and finalization evaluation in the acquisition transaction.

Civil-day conversion uses explicit timezone-derived civil parts. Focused tests cover midnight boundaries, DST spring-forward and fall-back, worker timezone independence, and pre-epoch dates in 1969, 1950 and 1900.

## Acceptance matrix

| ID | Result | Evidence |
|---|---|---|
| E01 | PASS | Current entities beyond J+30 covered by focused test and PostgreSQL recipe. |
| E02 | PASS | Current/future priority and absence of duplicate future traversal covered. |
| E03 | PASS | PostgreSQL `timestamptz`, UTC deadline arithmetic and timezone tests. |
| E04 | PASS | Worker-timezone-independent result is asserted. |
| E05 | PASS | Midnight boundary is asserted. |
| E06 | PASS | DST spring-forward case is asserted. |
| E07 | PASS | DST fall-back case is asserted. |
| E08 | PASS | Multiple worker timezone executions produce the same instant. |
| E09 | PASS | 1969 date is asserted. |
| E10 | PASS | 1950 date is asserted. |
| E11 | PASS | 1900 date is asserted. |
| E12 | PASS | Provider end has first priority and trace coverage. |
| E13 | PASS | Last-session end fallback and trace coverage. |
| E14 | PASS | Comparable-duration median fallback and trace coverage. |
| E15 | PASS | Comparable lookup is scoped by provider championship in code and PostgreSQL fixtures. |
| E16 | PASS | Entity kind/type compatibility is enforced when selecting peers. |
| E17 | PASS | An isolated postponed entity falls through to the civil rule, proving incompatible/no peers are ignored. |
| E18 | PASS | Latest-five peer selection is asserted. |
| E19 | PASS | Adapter-duration rule fallback and trace coverage. |
| E20 | PASS | Civil fallback and postponed replay are covered in PostgreSQL. |
| E21 | PASS | Estimation provenance/details and logic version are persisted and asserted. |
| E22 | PARTIAL | Final statuses are excluded and completion resolves an anomaly, but no dedicated fixture asserts `completed` specifically before J+30. |
| E23 | PASS | Exact T+29 exclusion is asserted in PostgreSQL. |
| E24 | PASS | Exact T+30 inclusion is asserted in PostgreSQL. |
| E25 | PASS | `cancelled` exclusion is asserted in PostgreSQL. |
| E26 | PASS | `postponed` remains non-final and creates an anomaly. |
| E27 | PASS | Completion after anomaly resolves the active anomaly. |
| E28 | PASS | Postponed date replay recomputes the theoretical end and resolves the obsolete anomaly. |
| E29 | PASS | Durable finalization seasons/cursor are persisted by migration 0021 and exercised in PostgreSQL. |
| E30 | PARTIAL | Durable replay in the same service process is covered; a fresh-process restart is not directly exercised by this recipe. |
| E31 | PASS | Finalization is integrated after persistence and exercised by orchestration PostgreSQL tests. |
| E32 | PASS | Transaction/crash/replay regression suite passes against PostgreSQL. |
| E33 | PASS | Scheduler fairness and stale-worker regressions pass. |
| E34 | PASS | Active anomaly uniqueness and repeated evaluation idempotence are asserted. |
| E35 | PASS | Git diff and test recipes show no implementation of Lot 5.7 functionality. |

Totals: **33 PASS, 2 PARTIAL, 0 FAIL, 0 NOT TESTED**.

## Executed validation

| Command | Result |
|---|---|
| `npm test --workspace @mse/api -- acquisitionOrchestrator.test.ts` | PASS — 11 passed, 0 failed, 0 skipped. |
| `./scripts/test-lot56-temporality.sh` | PASS — real PostgreSQL; migration up/down, T+29/T+30, idempotence, completed, cancelled, postponed, trace and replay. |
| `./scripts/test-lot56-transaction.sh` | PASS — real PostgreSQL; checkpoint, crash/replay, deduplication, stale/lost leases and concurrency races. |
| `./scripts/test-lot56-orchestration.sh` | PASS — real PostgreSQL; current windows, priority/fairness, durable finalization traversal, hierarchy and pre-1970 regression. |
| `./scripts/test-lot54-scheduler.sh` | PASS — real PostgreSQL plus 8 focused scheduler tests. |
| `./scripts/test-lot55-quota-cadence.sh` | PASS — real PostgreSQL; 61 quota/cadence cases, zero provider requests/credits in the protected cases, and migration rollback/reapply. |

## Risks and audit recommendation

The two PARTIAL items are test-evidence gaps, not observed functional failures: there is no explicit pre-J+30 `completed` fixture, and the replay scenario does not launch a fresh service process. The durable schema, transaction/replay coverage and implementation support both behaviors, but they are deliberately not reported as fully demonstrated.

No Lot 5.7 functional leakage was found in the implementation diff. No functional code was changed while producing this evidence.

**Technical recommendation: PASS FOR MAINTAINER AUDIT.** This recommendation is not maintainer validation and does not change any authorization gate.
