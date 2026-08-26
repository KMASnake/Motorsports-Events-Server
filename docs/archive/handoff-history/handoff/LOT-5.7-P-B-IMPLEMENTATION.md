# Lot 5.7-P-B — implementation evidence

Date: 2026-08-22

Status: **PASS — COMPLETED, AWAITING MAINTAINER AUDIT**

START_SHA: `74262589d7be53e0f559a74af738096901971371`

FINAL_SHA: `a77db5c4d0b1ffcde349fdbce196d51193cf0160` (immutable implementation/test commit)

## PRE_IMPLEMENTATION_INVENTORY

REUSED:

- private 5.6 source entities, traversal observations, finalization evidence and active/inactive corrections;
- A's Event/Meeting source links, normalized candidates, decisions and fenced checkpoints;
- existing Events, Meetings and the PostgreSQL transaction helper.

EXTENDED:

- the normalization module now contains pure explicit mapping, stable UUID/checksum, conservative Event/Meeting identity resolution and a transactional PostgreSQL application service.

NEW:

- versioned mapping configuration contract and deterministic effective-input mapper;
- bounded Event/Meeting candidate resolution using the normative Event thresholds 90/75, margin 15 and two structural signals;
- targeted B01–B32/unit suite and a real-PostgreSQL transaction/replay/fencing/concurrency recipe.

UNCHANGED:

- migration 0024 and every historical migration; all 5.6 source/correction data; public routes; Web; public state/change log; client auth, rights, quotas and ACP.

MIGRATION_REQUIRED: **NO**. A already persists every B output and transaction primitive; adding schema would duplicate those foundations.

## Implemented architecture

`5.6 source → effective input → explicit mapper → identity resolver → normalized candidate → linked/review/create/rejected decision → durable checkpoint`

The mapper accepts only explicit provider/championship configuration and injects mapping/rules versions, source ID/hash and field-level correction provenance. Active corrections affect a cloned effective input; inactive corrections remain stored but are ignored. Raw source is never updated. Unknown Session values become `other` with the human label; missing required championship/circuit identity becomes review.

Resolution order is durable link, required identity/hard incompatibility, deterministic Meeting identity or bounded Event score, then linked/review/create. Durable rejected targets are excluded. Equal/close scores and multiple Meetings go to review. No LLM, random value, implicit system time, machine locale/timezone or property-order dependency participates. Candidate/decision UUIDs and canonical checksums are stable.

Temporal mapping requires an explicit offset, emits UTC and retains the IANA zone. Reliable source end beats estimation; estimated end stays internal. Completed/cancelled require explicit evidence. J+30 produces an internal finalization anomaly without forging completed, and later reliable completion resolves it. Complete-traversal evidence is required for `not_observed`; absence never deletes identities, links or corrections.

One PostgreSQL transaction locks the 5.6 source revision, reads corrections/observations, performs a candidate query capped at 51 to reject more than 50, persists candidate/decision/link, and advances the fenced monotone checkpoint last. Exact replay reuses the durable candidate and is a checkpoint no-op. Stale fencing rolls back all prior writes. Concurrent replay converges without duplicate.

## Tests and results

- B targeted unit tests: **37/37 PASS**, including B01–B32 plus Meeting matching, durable rejection and PP-183 resolution;
- real PostgreSQL B recipe: PASS for first run, exact replay, provider update/same UUID, active/disabled correction, stale rollback, two concurrent workers and durable cardinalities;
- API typecheck/lint/build: PASS; API tests: **250/250**, 30 files;
- Web typecheck/lint/build/tests: PASS, **42/42**, 6 files; Web changes: none;
- security: **52/52 PASS**; malformed/oversized input, prototype keys, offset-less time, bounded search and payload leakage have negative coverage;
- non-regression A: PostgreSQL foundations A01–A18 PASS;
- non-regression 5.6: foundations/storage, acquisition 72/72, transaction, orchestration, temporal/restart and corrections/observations PASS;
- scheduler 5.4 PASS; quota/cadence 5.5: 61 cases PASS;
- provider requests: 0; provider credits: 0; `scripts/validate-repository.sh`: PASS.

## Acceptance matrix

| Requirement | Implemented | Test | Result | Evidence |
|---|---:|---|---|---|
| PP-T07 | YES | B01/B23/B28 + PostgreSQL replay | PASS | identical candidate/decision/UUID; checkpoint no-op |
| PP-T08 | YES | B02/B03 + provider-update recipe | PASS | durable link keeps `evt-002` |
| PP-T09 | YES | B03–B05 + Meeting tests | PASS | normative resolution order and hard filters |
| PP-T10 | YES | B06 + Meeting ambiguity | PASS | ambiguity always review |
| PP-T11 | YES | B07/B08 | PASS | explicit mapping/rules versions and provenance |
| PP-T12 | YES | B09/B10 | PASS | other+label; required identity review |
| PP-T13 | YES | B11/B12 + PostgreSQL recipe | PASS | active/inactive correction and raw preservation |
| PP-T14 | YES | B13–B16 | PASS | complete traversal, cancelled/postponed, non-destructive |
| PP-T15 | YES | B17–B22 + PP-183 test | PASS | UTC, DST offsets, pre-1970 and finalization hierarchy |
| PP-T16 | YES | B23–B28 + PostgreSQL recipe | PASS | atomic checkpoint, stale rollback, retry/concurrency |
| PP-030 | YES | B01/B03 + PostgreSQL | PASS | Event source link is durable |
| PP-031 | YES | Meeting matching | PASS | Meeting link path reuses A repository |
| PP-032 | YES | B03 + replay | PASS | durable link wins before matching |
| PP-033 | YES | B01/B28 + PostgreSQL | PASS | repeated input converges without duplicate |
| PP-034 | YES | B07/B08 | PASS | normalization version persisted |
| PP-035 | YES | B02/B07 | PASS | version change cannot steal durable link |
| PP-036 | YES | B08 + candidate/decision rows | PASS | source, version, rule and correction provenance |
| PP-037 | YES | B03 | PASS | linked identity has priority |
| PP-038 | YES | B04 | PASS | strong incompatibilities eliminate candidate |
| PP-039 | YES | threshold test | PASS | auto-match threshold 90 |
| PP-040 | YES | B05/B06 | PASS | review threshold 75 |
| PP-041 | YES | B06 | PASS | margin below 15 means review |
| PP-042 | YES | B05 | PASS | at least two structural signals |
| PP-043 | YES | hard session-type filter | PASS | distinct practices cannot merge |
| PP-044 | YES | hard session-type filter | PASS | Sprint/Race cannot merge |
| PP-045 | YES | B05 scoring | PASS | no single fuzzy signal auto-matches |
| PP-046 | YES | architecture/diff audit | PASS | no LLM dependency |
| PP-047 | YES | Meeting matching | PASS | championship/season required |
| PP-048 | YES | Meeting round test | PASS | reliable round provides deterministic link |
| PP-049 | YES | Event meeting signal test | PASS | common Meeting signal scores 35 |
| PP-050 | YES | Meeting identity test | PASS | sponsor/name is not required identity |
| PP-051 | YES | Meeting ambiguity test | PASS | multiple plausible Meetings mean review |
| PP-052 | YES | B03 + PostgreSQL link | PASS | linked decision/source link replayable |
| PP-053 | YES | rejected-target test | PASS | rejected target is not reproposed |
| PP-054 | YES | PostgreSQL decision rows | PASS | actor, reason, target and timestamp audited |
| PP-055 | YES | B11 + provider update | PASS | active override survives source update |
| PP-056 | YES | B11/B12 | PASS | effective candidate follows active state |
| PP-057 | YES | PostgreSQL correction row | PASS | convergence/update never deletes override |
| PP-058 | YES | B13/B14 | PASS | absence never deletes/unpublishes |
| PP-059 | YES | B15 | PASS | explicit cancellation retained |
| PP-060 | YES | B16 | PASS | postponed retained, never completed |
| PP-061 | YES | B13/B32 | PASS | removed never inferred from absence |
| PP-181 | YES | B21 | PASS | reliable source end precedes estimation |
| PP-182 | YES | B22 | PASS | J+30 anomaly without forged completed |
| PP-183 | YES | finalization resolution test | PASS | reliable completed resolves anomaly |

Acceptance applicable to B: **45 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED**.

## Boundary, known issue and recommendation

NEW_PUBLIC_CLIENT_ENDPOINTS: 0

PUBLICATION_IMPLEMENTED: NO

PUBLIC_RESOURCE_STATE: NOT FUNCTIONALLY IMPLEMENTED

LAST_KNOWN_GOOD / PUBLIC_CHANGE_LOG / PROMOTION: NO

API_PREVIEW / `/api/v1/changes` / CLIENT AUTH / KEYS / ENTITLEMENTS / QUOTAS / ACP: NOT IMPLEMENTED

The inherited, non-blocking 5.6-G P3 remains unchanged: invalid anomaly query returns `[]` instead of HTTP 400.

FINAL_RECOMMENDATION: **PASS FOR MAINTAINER AUDIT**
