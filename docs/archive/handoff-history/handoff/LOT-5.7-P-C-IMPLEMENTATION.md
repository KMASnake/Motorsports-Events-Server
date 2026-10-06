# Lot 5.7-P-C — implementation evidence

Date: 2026-08-22  
Status: **PASS — ADDITIVE CORRECTION MAINTAINER REVALIDATED 2026-08-22**

START_SHA: `6da9049e9dd6efe680d107e87d8e659290a4c6ef`  
FINAL_SHA: `2ef24abc2c35feafd5b687b988604fe8b92066f9` (immutable implementation/test commit)

## PRE_IMPLEMENTATION_INVENTORY

REUSED: B normalized candidates/decisions, A normalized UUID/source links,
normalization checkpoints/fencing, PostgreSQL transaction helper and 5.6 source.

EXTENDED: normalization module with a C-only internal publication boundary;
historical migration recipes with the required 0025→0024 down order.

NEW: migration 0025, canonical publication domain, PostgreSQL publication
service, C unit tests and real-PostgreSQL recipe.

UNCHANGED: A/B behavior, 5.6 data and rules, API routes, Web, client auth,
entitlements, quotas and ACP.

## ARCHITECTURE AND MIGRATION

`B candidate → quality gate → public_resource_states → revision → public_change_log`
is one PostgreSQL transaction. `publication_receipts` makes retry idempotent;
an advisory transaction lock serializes each resource. PostgreSQL owns the
durable bigint sequence. `publication_controls` supplies the backend kill
switch and `publication_rebuild_checkpoints` supplies ordered rebuild progress.

MIGRATION_REQUIRED: **YES**. No existing table stores an effective public
projection or atomic public journal. Migration 0025 is additive, indexed by
UUID/championship/sequence, refuses populated destructive DOWN by default and
passes disposable DOWN/reapply.

## PUBLICATION, LKG AND GRANULAR BLOCKING

Only create/linked candidates with required identities are ready. Review or
blocked candidates neither create a first state nor replace an existing state.
Canonicalization allowlists public fields, excluding provenance/diagnostics;
equal effective state produces no revision or change. Event quality degrades
only its Meeting/Championship projection according to the tested criticality,
never the complete dataset implicitly. The kill switch stops promotion while
preserving state, candidates, mappings, receipts and history.

## REVISION, CHANGE LOG AND TOMBSTONES

Each effective mutation increments the per-resource revision and appends one
change entry in the same commit. Sequence allocation is restart/concurrency
safe. `cancelled` remains an `updated/status` state. Explicit removal writes a
permanent tombstone with the same UUID and an internal `removed` change; retry
cannot resurrect it.

## ATOMICITY, CONCURRENCY AND CRASH/RETRY

An injected exception after state/change writes but before commit rolls back
state, revision, receipt and journal. Retry after commit observes the receipt.
Concurrent identical workers converge to one state/revision/sequence. Stale
fence generation is refused before promotion. No counter or clock-derived
business identity exists in memory.

## REBUILD AND PRE-1970

From-scratch replay and incremental replay use stable candidate ordering and
durable receipts/checkpoints. Both converge to identical effective state;
UUIDs, tombstones and public sequences are never reset. A 1965 timestamp
crosses canonicalization and PostgreSQL `timestamptz` unchanged.

## SECURITY AND PERFORMANCE

All values use parameterized SQL; resource UUID and payload size are bounded.
Only allowlisted public fields enter the projection. No source payload,
correction, credential or provenance enters public state/change rows. Required
indexes cover UUID, championship, tombstones, resource history and sequence.
No HTTP surface was added.

## TEST RESULTS

- C unit suite: **9/9 PASS**;
- C PostgreSQL recipe C01–C35: PASS, including migration, rollback, retry,
  concurrent replay, kill switch, tombstone, rebuild and pre-1970;
- API typecheck/lint/build: PASS; API tests: **259/259**, 31 files;
- A foundations A01–A18: PASS; B normalization B01–B32: PASS;
- 5.6 foundations, acquisition 72/72, transaction, orchestration,
  temporal/restart and corrections/observations: PASS;
- scheduler 5.4: PASS; quota/cadence 5.5: **61 PASS**;
- provider requests: 0; provider credits: 0;
- Web: NOT REQUIRED; Web source changes: none.

## ACCEPTANCE MATRIX

| Requirement | Implemented | Test | Result | Evidence |
|---|---:|---|---|---|
| PP-T17 | YES | C02/C03 | PASS | state, revision, receipt and journal transaction + injected rollback |
| PP-T18 | YES | C05/C06 | PASS | canonical equality/internal-only no-op |
| PP-T19 | YES | C12/C13 | PASS | review retains LKG; bad first candidate absent |
| PP-T20 | YES | C14–C17 | PASS | Event/Meeting/Championship granularity and kill switch |
| PP-T21 | YES | C18–C21 | PASS | cancelled update; permanent removed tombstone |
| PP-T22 | YES | C26–C29 | PASS | from-scratch/incremental convergence and UUID retention |
| PP-062–065 | YES | C01/C05/C12/C13 | PASS | explicit quality states, LKG and no rejected change |
| PP-066–073 | YES | C14/C15/C17 | PASS | bounded degradation, stale preservation, no automatic suspension |
| PP-088 | YES | C10/C11 | PASS | durable monotone PostgreSQL sequence |
| PP-092–093 | YES | C02/C03 | PASS | state/log atomicity under injected crash |
| PP-095–098 | YES | C07/C08/C18/C19 | PASS | resource revision, changed fields, cancelled/Meeting semantics |

Applicable C matrix: **25 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED**.
PP-086/087/089–091/094/099–104 require the client API/cursor/entitlement
surface owned by D/E and are intentionally not claimed or implemented by C.

## BOUNDARY D-F AND KNOWN ISSUES

NEW_PUBLIC_CLIENT_ENDPOINTS: 0  
PUBLIC_STATE_STORAGE: YES  
PUBLIC_CLIENT_ACCESS: NO  
API_PREVIEW_IMPLEMENTED: NO  
`/api/v1/changes`: NOT IMPLEMENTED  
CLIENT_AUTH / ENTITLEMENTS / QUOTAS / ACP: NO

5.7-P-D/E/F, full 5.7, 5.8+ and merge main remain unauthorized. The inherited
non-blocking P3 remains unchanged: invalid anomaly query returns `[]` instead
of HTTP 400.

## ENGINE USAGE

TIER_1: all reading, implementation, tests, PostgreSQL diagnosis,
documentation, governance and Git.  
TIER_2: not used.  
TIER_3: not used.

FINAL_RECOMMENDATION: **PASS FOR MAINTAINER AUDIT**

## Maintainer validation

- MAINTAINER_AUDIT: **PASS**
- MAINTAINER_VALIDATED: **TRUE**
- MAINTAINER_VALIDATION_DATE: **2026-08-22**
ACCEPTANCE: **25 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED**

## Additive C/D correction — 2026-08-22

The original current-state-only model could not reconstruct a page snapshot
after a concurrent mutation. Migration 0027 adds immutable
`public_resource_versions`; every new publication and tombstone now writes its
canonical public version atomically with current state, change log and receipt.
The migration baselines current state and records the earliest guaranteed
snapshot sequence without claiming recovery of older overwritten revisions.
No automatic purge is introduced. C01–C35, immutability, no-leak, transaction
rollback and idempotent rebuild proofs pass. This additive correction required
separate maintainer revalidation, recorded below.

## Additive correction maintainer revalidation

- VPS validated SHA: `90e7f7cf5bd975aeb7610c3f98d1dbef0f323b96`;
- migration head: `0027_lot57pc_public_resource_history`;
- migration fresh/upgrade/DOWN/UP: PASS;
- C01–C35 publication/transaction/rebuild: PASS;
- immutable public history, snapshot baseline and cleanup: PASS;
- MAINTAINER REVALIDATED: **TRUE — 2026-08-22**.

This revalidation does not authorize 5.7-P-E/F, full Lot 5.7, Lot 5.8+ or
merge main.
