# Lot 5.6-F — Protection of corrections and observations evidence

Date: 2026-08-21

Start SHA: `a26648924e8afd2f5b141a4179cf3bbe0a8cadb3`

Implementation final SHA: `dc66103d95a3431441a30a4335a2309bcdd4f71c`

Status: **IMPLEMENTED — MAINTAINER AUDIT REQUIRED**

## Mechanism

Migration 0023 adds two source-layer stores that remain physically separate from provider payloads and from each other. `provider_source_corrections` records field path, override value, source value observed at creation, reason, origin, actor, lifecycle, revision and timestamps. `provider_source_local_observations` records a stable key, kind, bounded object details, reason, origin, actor, revision and timestamps. Both reference the durable source entity with restrictive deletion.

`SourceProtectionService` validates bounded paths, keys, provenance and JSON, then locks the same `provider_source_entities` row used by acquisition before writing either protected record. Provider acquisition continues to update only `source_data`; it never updates or deletes protected records. Source change audit rows now identify both source-layer and legacy event overrides as active. Complete traversal absence remains a separate `not_observed` fact and is non-destructive.

The down migration exists for disposable databases and refuses to drop populated protected tables unless `mse.allow_destructive_lot56_down=on` is explicitly set.

## Implementation inventory

- `apps/api/src/providers/sourceProtectionService.ts`: transactional correction/observation persistence, provenance, row locking and validation.
- `apps/api/src/providers/acquisitionTransactionService.ts`: recognizes active source-layer corrections in provider change audit without altering provider persistence.
- `infra/postgres/migrations/0023_lot56_source_protection.up.sql`: additive protected tables, constraints and indexes.
- `infra/postgres/migrations/0023_lot56_source_protection.down.sql`: guarded rollback.
- `apps/api/tests/sourceProtectionService.test.ts`: focused path/key/payload validation.
- `scripts/test-lot56-corrections-observations.sh`: disposable PostgreSQL recipe and two-process restart.
- `scripts/validate-lot56-corrections-observations.mjs`: real persistence, concurrency, absence, rollback, stale/crash and replay assertions.
- `scripts/test-lot54-scheduler.sh`: rollback chain includes 0023 before its 0016 dependency.

## Acceptance matrix

| ID | Result | Executed evidence |
|---|---|---|
| F01 | PASS | Provider A is stored normally without a correction. |
| F02 | PASS | Provider B updates source while the active correction remains intact. |
| F03 | PASS | Identical Provider A replay preserves correction cardinality. |
| F04 | PASS | A→B changes source to B and preserves the local override. |
| F05 | PASS | Deactivation retains the inactive correction and permits a new active correction under the existing lifecycle rule. |
| F06 | PASS | Local observation remains after provider update. |
| F07 | PASS | Local observation remains after identical replay. |
| F08 | PASS | Separate tables and cardinality assertions distinguish observation from override. |
| F09 | PASS | Complete provider absence leaves corrections unchanged. |
| F10 | PASS | Complete provider absence leaves local observations unchanged. |
| F11 | PASS | Incomplete traversal creates no `not_observed` fact and deletes nothing. |
| F12 | PASS | Complete empty traversal records `not_observed` without destructive mutation. |
| F13 | PASS | Concurrent provider C update and correction update serialize on the source row without loss. |
| F14 | PASS | Concurrent provider C update and observation update serialize without loss. |
| F15 | PASS | Transaction rollback removes the attempted correction only and preserves existing protected records. |
| F16 | PASS | A new Node process reloads the correction solely from PostgreSQL. |
| F17 | PASS | A new Node process reloads the observation solely from PostgreSQL. |
| F18 | PASS | Stale worker is rejected and correction cardinality is unchanged. |
| F19 | PASS | Stale worker is rejected and observation cardinality is unchanged. |
| F20 | PASS | Cursor remains at the last durably committed source/protection state after simulated crash. |
| F21 | PASS | Provider D duplicate retry keeps one source entity, one active correction and one observation. |
| F22 | PASS | Correction origin, actor, reason, source snapshot and revision persist. |
| F23 | PASS | Observation origin, actor, reason, details and revision persist. |
| F24 | PASS | Corrected source entity retains its 1969 provider instant. |
| F25 | PASS | Unit tests and PostgreSQL constraints reject unsafe paths/keys and payloads over 65536 bytes. |
| F26 | PASS | Diff contains source protection only; no normalization, publication, client API or other 5.7 surface. |

Totals: **26 PASS, 0 PARTIAL, 0 FAIL, 0 NOT TESTED**.

## Commands executed

- `npm test --workspace @mse/api -- sourceProtectionService.test.ts`: PASS — 4/4.
- `npm run typecheck --workspace @mse/api`: PASS.
- `npm run lint --workspace @mse/api`: PASS.
- `npm run build --workspace @mse/api`: PASS.
- `npm test --workspace @mse/api`: PASS — 206/206.
- `./scripts/test-lot56-corrections-observations.sh`: PASS — real PostgreSQL, migration down/up and two distinct Node processes.
- `./scripts/test-lot56-transaction.sh`: PASS.
- `./scripts/test-lot56-orchestration.sh`: PASS.
- `./scripts/test-lot56-temporality.sh`: PASS.
- `./scripts/test-lot54-scheduler.sh`: PASS — including 8/8 focused tests and migration rollback/reapply.
- `./scripts/test-lot55-quota-cadence.sh`: PASS — 61 cases, zero provider requests and zero credits.

## Risks and boundary

The service is internal in 5.6-F; administrative HTTP actions belong to 5.6-G and are intentionally absent. The protected data model does not compute an effective business Event, merge providers, or introduce any 5.7 reconciliation. Operational rollback is intentionally blocked when protected data exists unless destructive intent is explicit.

**Technical recommendation: PASS FOR MAINTAINER AUDIT.** This is not maintainer validation and does not authorize 5.6-G, 5.7+, or merge to `main`.
