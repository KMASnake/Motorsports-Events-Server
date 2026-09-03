# Lot 5.7-P-A — implementation evidence

Date: 2026-08-22
Status: **PASS — COMPLETED, AWAITING MAINTAINER AUDIT**

START_SHA: `422dbad133cc8e8e479dbe497699ae39f5cf2e71`
FINAL_SHA: `b458bb9c195bccd5c8d8a6106c18812747508a52` (immutable implementation/test commit audited by this evidence)

## PRE_IMPLEMENTATION_INVENTORY

REUSED:

- `championships`, `events` and `circuits`, including the Event-as-Session model;
- 5.6 `provider_source_entities`, provider identity/championship structures, corrections, observations and finalization as the private authoritative source graph;
- the migration runner, PostgreSQL pool/client transaction convention and existing migration recipes.

EXTENDED:

- `events` receives only nullable `normalized_uuid` and lifecycle identity columns plus additive constraints. Existing rows and `/api/v1` contracts remain compatible.

NEW:

- migration `0024_lot57pa_normalized_persistence` UP/DOWN;
- minimal `meetings`, `meeting_events`, Event/Meeting source links, normalized candidates, decisions, checkpoints and UUID tombstones;
- minimal persistence contracts and PostgreSQL repository for candidates, decisions and atomic fenced checkpoints;
- dedicated unit and real-PostgreSQL recipes.

NOT_NEEDED:

- no second Session table: `events` remains the business Session and Meeting sessions are projections;
- no public state/change-log (gate C), Preview API (D), client security/quota/ACP (E), normalizer or mapping engine (B), or certification implementation (F).

### New-table justification

| Table | Why existing schema is insufficient | Gate requirement |
|---|---|---|
| `meetings`, `meeting_events` | No durable grouping identity/relation exists; legacy Session duplication is intentionally avoided. | PP-T04, PP-024–028 |
| `event_source_links`, `meeting_source_links` | 5.6 persists private source identity but no durable source→normalized identity boundary. | PP-T03, PP-030–035 |
| `normalized_candidates` | No bounded, versioned candidate persistence exists. | A candidate primitive |
| `normalization_decisions` | No durable, constrained/idempotent decision record exists. | A decision primitive |
| `normalization_checkpoints` | 5.6 acquisition checkpoints cannot represent a future normalization cursor/version/fence. | A checkpoint primitive |
| `normalized_identity_tombstones` | Existing deletion state cannot reserve a normalized UUID permanently. | PP-T05, PP-008–009 |

## Implementation and constraints

The additive migration creates UUID/FK/check/unique/index constraints in dependency order. Source links are one-to-one from a 5.6 source entity; candidates and decisions have database-backed idempotency, including `NULLS NOT DISTINCT`. Tombstone triggers reject both reuse of a reserved UUID and tombstoning of an active identity. Checkpoint upsert is parameterized, fenced and monotone; a null timestamp cannot regress a non-null cursor. Candidate JSON is object-only and bounded to 64 KiB. The DOWN migration refuses populated destructive rollback unless explicitly enabled on a disposable database and otherwise drops reverse-FK order.

No repository performs scoring, matching, promotion, publication or public routing. All SQL values are parameters; no dynamic identifiers or source-payload logging were added.

## Test results

Dedicated `scripts/test-lot57pa-foundations.sh`: A01–A18 **18 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED** on PostgreSQL. It proves fresh/current migration, preservation, down/up, Meeting/Event, stable UUID, link/candidate/decision/checkpoint persistence, uniqueness, concurrency, tombstone non-reuse, pre-1970, rollback, restart, no client route and no B–F surface.

- fresh DB → all migrations → 0024: PASS;
- current pre-A DB → 0024 with legacy data preserved: PASS;
- populated destructive down refusal, disposable down and reapply: PASS;
- source-link/candidate races and concurrent monotone checkpoint: PASS;
- API typecheck/lint/build: PASS; API tests: **213/213**, 29 files;
- Web typecheck/lint/build: PASS; Web tests: **42/42**, 6 files; Web source changes: none;
- focused repository unit tests: **4/4**;
- security suites: **52/52**;
- `scripts/validate-repository.sh`: PASS (51 Python checks, 18 dependency-gated skips);
- 5.6 foundations/storage, acquisition (72/72), transaction, orchestration, temporality and corrections/observations: PASS;
- 5.4 scheduler and migration 0011→0024: PASS; 5.5 quota/cadence (61 cases): PASS;
- real provider requests: 0; provider credits consumed: 0.

## Architecture and scope boundary

`git diff` adds persistence/migration/repository/test/documentation only. It changes no Web UI, route registration, public/client API, client auth, entitlements, quota, ACP, normalizer, mapping, publication, last-known-good or change-log implementation.

NEW_PUBLIC_CLIENT_ENDPOINTS: 0

API_PREVIEW_IMPLEMENTED: NO

`/api/v1/changes`: NOT IMPLEMENTED

NORMALIZATION_WORKER: NOT IMPLEMENTED

NORMALIZATION_MAPPING: NOT IMPLEMENTED

AUTO_MATCH: NOT IMPLEMENTED

SCORING: NOT IMPLEMENTED

PUBLICATION: NOT IMPLEMENTED

LAST_KNOWN_GOOD: NOT IMPLEMENTED

CHANGE_LOG: NOT IMPLEMENTED

CLIENT_API_KEYS / ENTITLEMENTS / QUOTAS / ACP: NOT IMPLEMENTED

## Acceptance matrix

| Requirement | Implemented | Test | Result | Evidence |
|---|---:|---|---|---|
| PP-T01 | YES | A01/A02 | PASS | fresh/current additive migration |
| PP-T02 | YES | A03 | PASS | refusal, down and reapply |
| PP-T03 | YES | A06/A07 | PASS | FK/unique and concurrent source link |
| PP-T04 | YES | A04 | PASS | zero-or-one Meeting relation; no Session copy |
| PP-T05 | YES | A05/A13/A14 | PASS | UUID uniqueness/tombstone/pre-1970 |
| PP-T06 | YES | A17/A18 + API checks | PASS | repository-only diff; zero route |
| PP-001 | YES | A17/security | PASS | private source schema unexposed |
| PP-002 | YES | A17 | PASS | no Preview namespace/endpoint |
| PP-003 | YES | A04/A18 | PASS | Event-as-Session preserved |
| PP-004 | YES | schema review | PASS | durable non-throwaway primitives |
| PP-005 | YES | A05 | PASS | normalized UUID independent of source IDs |
| PP-007 | YES | A04/A05/A16 | PASS | Meeting UUID persists across restart |
| PP-008 | YES | A13 | PASS | permanent UUID reservation |
| PP-009 | YES | migration constraints | PASS | removed identity retained structurally |
| PP-024 | YES | A04/A16 | PASS | durable Meeting resource |
| PP-025 | YES | A04 | PASS | unique `meeting_events.event_id` |
| PP-026 | YES | A04/A18 | PASS | no copied Session entity |
| PP-028 | YES | A04 | PASS | nullable temporal Meeting fields |
| PP-030 | YES | A06/A07/A16 | PASS | durable Event source link |
| PP-031 | YES | A06/A16 | PASS | durable Meeting source link |
| PP-034 | YES | A08/A10/A11 | PASS | explicit normalization version |
| PP-035 | YES | A06/A10 | PASS | uniqueness prevents silent remap primitives |
| PP-036 | YES | schema/repository tests | PASS | source/candidate/actor/version retained privately |

Criteria requiring active replay, matching, correction application or publication belong to later gates and are intentionally absent rather than claimed by A. For the A matrix above: **23 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED**.

## Known issues and governance

The inherited non-blocking P3 remains unchanged: an invalid anomaly query returns `[]` instead of HTTP 400. It is outside A.

5.7-P implementation progress is recorded by completed-gate count because governance defines no weights for A–F. To avoid inventing 16/17/20%, the numeric percentage remains 0 while `completed_technical_gates=["5.7-P-A"]` is canonical. A is complete but not maintainer-validated. No subsequent gate is authorized; merge remains false.

FINAL_RECOMMENDATION: **PASS FOR MAINTAINER AUDIT**
