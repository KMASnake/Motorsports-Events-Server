# Lot 5.7-P — Technical gates

Date : 2026-08-22
Status : **5.7-P-C REVALIDATED / 5.7-P-D MAINTAINER VALIDATED — E UNAUTHORIZED**

Each gate requires explicit maintainer authorization before implementation and
explicit maintainer validation before the next gate may be opened.

## Sequence

| Order | ID | Name | Initial status | Depends on |
|---|---|---|---|---|
| 1 | 5.7-P-A | Normalized identity and persistence foundations | CANDIDATE — NOT AUTHORIZED | validated 5.6 |
| 2 | 5.7-P-B | Deterministic normalization and source mapping | NOT AUTHORIZED | validated A |
| 3 | 5.7-P-C | Publication state, last-known-good and change log | NOT AUTHORIZED | validated B |
| 4 | 5.7-P-D | Read-only V1 Preview API and incremental sync | MAINTAINER VALIDATED | validated C and VPS A/B/C |
| 5 | 5.7-P-E | Client security, entitlements, limits and minimal ACP | NOT AUTHORIZED | validated D |
| 6 | 5.7-P-F | F1 vertical certification and operational readiness | NOT AUTHORIZED | validated E |

## 5.7-P-A — Normalized identity and persistence foundations

- Objective: add the permanent persistence/repository foundation without
  normalizing or publishing data.
- In scope: legacy-schema inventory, Meetings and Event relation, durable
  source links, candidates/decisions/checkpoints, UUID/tombstone constraints,
  additive reversible migrations and repository contracts.
- Out of scope: mapping engine, public promotion/API, auth, quota and ACP.
- Dependencies: validated 5.6 schema and source contracts.
- Files expected: migration up/down files, domain/application persistence
  contracts, infrastructure repositories and focused tests.
- Migrations expected: YES.
- Security concerns: source isolation, UUID reuse, unsafe DDL, concurrency.
- Acceptance: PP-T01–06 plus PP-001–009 and relevant PP-024–036.
- Tests: fresh/current PostgreSQL up/down/up, constraints/races, repository
  integration, architecture and pre-1970 tests.
- Stop rule: stop after evidence and handoff; no normalizer or route.
- Maintainer audit required: YES.

## 5.7-P-B — Deterministic normalization and source mapping

- Objective: convert 5.6 envelopes to replayable normalized candidates and
  stable identities.
- In scope: mappings, provenance, matching/review, active corrections,
  presence/freshness, temporal/finalization rules, transaction/checkpoint.
- Out of scope: public promotion/API and complex cross-provider merge.
- Dependencies: validated A and all 5.6 read interfaces.
- Files expected: pure domain rules, application worker/use cases,
  repositories/configuration and tests.
- Migrations expected: only additive correction if A evidence proves necessary.
- Security concerns: raw-payload leakage, malicious values, stale worker.
- Acceptance: PP-T07–16 and functional PP-030–061/181–183.
- Tests: deterministic replay, concurrency/fencing, mapping tables, override,
  absence, DST/pre-1970 and restart in another process.
- Stop rule: stop with candidates only; do not expose client data.
- Maintainer audit required: YES.

## 5.7-P-C — Publication state, last-known-good and change log

- Objective: promote reliable candidates atomically into durable public state.
- In scope: quality decisions, granular blocking, revisions, tombstones,
  monotone journal, kill switch and deterministic rebuild.
- Out of scope: HTTP routes, client authentication and commercial features.
- Dependencies: validated B.
- Files expected: domain transitions, application promotion/rebuild use cases,
  additive migration/repositories and tests.
- Migrations expected: YES.
- Security concerns: unsafe promotion, sequence rollback, cross-scope impact.
- Acceptance: PP-T17–22 and functional PP-062–073/086–104.
- Tests: atomic crash boundaries, unchanged state, last-known-good, granular
  failures, remove/cancel and from-scratch/incremental rebuild.
- Stop rule: stop before creating or changing public routes.
- Maintainer audit required: YES.

## 5.7-P-D — Read-only V1 Preview API and incremental sync

- Objective: expose definitive normalized read contracts without client access
  being opened prematurely.
- In scope: OpenAPI, representations, filters, pagination, snapshot and
  `/changes`, safe errors and hard query bounds.
- Out of scope: API keys/entitlements/quota and write APIs.
- Dependencies: validated C.
- Files expected: shared contracts, API routes/queries/serializers, OpenAPI and
  contract/security tests.
- Migrations expected: NO unless cursor retention evidence requires an additive
  index already approved in C.
- Security concerns: internal-field leakage, injection, enumeration, N+1,
  cursor abuse.
- Acceptance: PP-T23–28 and PP-074–104.
- Tests: contract snapshots, filters/cursors/expiry, data-leak negatives,
  bounded SQL plans and compatibility `/api/v1` regression.
- Stop rule: routes remain unavailable to external clients until E is validated.
- Maintainer audit required: YES.

## 5.7-P-E — Client security, entitlements, limits and minimal ACP

- Objective: safely authorize the F1 Preview client dataset.
- In scope: clients/keys, scopes, F1 entitlements, rate/quota, request audit and
  minimal manual ACP operations.
- Out of scope: billing, self-service, public browser keys and full portal.
- Dependencies: validated D and server-side secret management.
- Files expected: additive migrations, crypto/auth middleware, authorization
  policies, counters, admin endpoints/UI minimum and security tests.
- Migrations expected: YES.
- Security concerns: key disclosure, auth bypass, timing, entitlement leakage,
  counter races and logging.
- Acceptance: PP-T29–35 and PP-105–135/180.
- Tests: key lifecycle, timing-safe verification, multi-key rotation,
  401/403/404, cursor rights, concurrent limits and redaction.
- Stop rule: no Production visibility switch or external client onboarding.
- Maintainer audit required: YES.

## 5.7-P-F — F1 vertical certification and operational readiness

- Objective: prove the complete permanent path before a separate launch
  decision.
- In scope: F1 E2E, staging, deployment, health, security, monitoring minimum,
  backup/restore, rollback, release artifact and smoke proof.
- Out of scope: launch authorization, all-championship rollout, 5.8 platform,
  billing and merge to main.
- Dependencies: validated E and separately approved test credentials/runtime.
- Files expected: validation recipes, fixtures, operational documentation and
  evidence; functional changes only if separately authorized corrections arise.
- Migrations expected: NO by default.
- Security concerns: live secrets, production mutation, rollback and exposure.
- Acceptance: PP-T36–40 and PP-136–183.
- Tests: real PostgreSQL/Docker, controlled provider fixture/approved calls,
  E2E, OpenAPI, security, load bounds, backup/restore and release rollback.
- Stop rule: stop for final maintainer audit; do not switch F1 to Preview,
  onboard a client, merge main or open full 5.7.
- Maintainer audit required: YES.

## Current audit gate

`5.7-P-D — Read-only V1 Preview API and incremental sync` is maintainer
validated. There is no current implementation gate because E is unauthorized.

Prerequisites:

- 5.7-P-A maintainer validated;
- 5.7-P-B maintainer validated;
- 5.7-P-C additive public-history correction maintainer revalidated;
- VPS A/B/C validated at
  `90e7f7cf5bd975aeb7610c3f98d1dbef0f323b96` for the C/D correction.

Status: **MAINTAINER VALIDATED — 2026-08-22**.

5.7-P-E/F, full Lot 5.7, Lot 5.8+ and merge main remain unauthorized.
