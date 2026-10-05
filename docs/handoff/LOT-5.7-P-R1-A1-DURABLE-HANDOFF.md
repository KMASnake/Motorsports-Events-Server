# R1-A1 — Durable canonical handoff primitives

This implementation slice uses the maintainer's R1-A1 instruction on the R0
base `88f581430397df83698d4cf6dca698923906e767`, tree
`6ccb8337b53661ab3b2f09d733a0c8e91b1d87ec`. This document specifies the
representation and test procedure; current project state and authorizations
remain exclusively in `PROGRESS.json`. It is not maintainer certification.

## Persisted representation

Each acquisition stream retains its existing `historical_state` fields and an
application-owned JSONB namespace:

```json
{
  "canonical_handoff_v1": {
    "version": 1,
    "traversals": {
      "00000000-0000-4000-8000-000000000001": {
        "state": "HANDOFF_PENDING",
        "attempts": 0,
        "updated_at": "2026-10-05T12:00:00.000Z",
        "error_code": null
      }
    }
  }
}
```

Entries contain orchestration metadata only, no payload copies or credentials.
Unknown versions, malformed entries and replacement namespace injection fail
closed or are refused by the authoritative writer. Terminal entries remain
recorded; no pruning or migration is added.

`ACQUIRING` records traversal creation/resumption. Only the final, completely
persisted acquisition transaction writes `HANDOFF_PENDING`, atomically with
observations, traversal completeness, acquisition progress, cursor and run.
Incomplete or failed traversals never become pending canonical work.

The canonical transaction writes `DONE` or `DONE_WITH_REVIEW` with canonical
contributions, resources, normalization decisions, public states, versions and
changes. Reviews retain fail-closed evidence and never imply provider retry.
An all-rejected handoff is terminal without claiming publication.

Unprocessed promotion outcomes produce `HANDOFF_PAUSED`, not `no_changes`.
This includes the publication kill switch. A technical exception rolls back
canonical work to a savepoint and persists `HANDOFF_BACKOFF` in the outer
transaction. Known traversal eligibility/ownership/binding/obsolescence failures
produce `HANDOFF_BLOCKED`. Only stable error codes are stored; exception messages
are not persisted. A database connection/process failure before outer commit
leaves the original pending state intact.

`HANDOFF_BACKOFF` identifies retryable OFFLINE work; A1 defines no delay,
automatic retry loop or provider retry policy. Those remain later work.

## Offline recovery and explicit disposition

`CanonicalAcquisitionPublicationService.recoverPendingHandoff(now, streamId?)`
selects one `HANDOFF_PENDING` or `HANDOFF_BACKOFF` entry and executes canonical
work inside the same transaction as its durable outcome. It never constructs a
provider runner, loads a credential, invokes an adapter, or calls HTTP.
A fresh process can discover work committed by a previous process.

Paused, blocked, acquiring and terminal entries are not selected automatically.
`resolveHandoff()` is an INTERNAL administrative primitive, with no HTTP route
or automatic caller. It requires actor, request ID, nonempty reason and expected
attempt count, persists its disposition and admin audit atomically:

- `resume` explicitly returns a protected entry to pending;
- `abandon` records terminal `ABANDONED`, preserving acquisition history and
  acknowledging that canonical processing was deliberately discarded. This
  never claims `DONE`, publication or successful normalization.

The caller must have a separately authorized administrative/replay scope.
The existing `handoffTraversal(id)` remains an explicit offline replay surface;
calling it on terminal/historical work requires that separate scope. Recovery
selection itself never invokes this explicit replay on terminal entries.
No legacy traversal is automatically backfilled, inferred to be done, or replayed.

## Source replacement barrier and lock order

All protected handoffs (pending, backoff, paused, blocked) block acquisition
selection across every stream of the same provider championship link. Acquisition
creation and commit also check the barrier, so a previously leased concurrent
unit cannot replace source entities after pending becomes durable.

The existing singleton `scheduler_configuration` row is the transaction
serialization root. Scheduler mutations, traversal creation, canonical handoff,
administrative disposition and orchestration transactions that update related
historical state acquire it before streams or traversal/source rows. Related
streams are locked in UUID order before the traversal and canonical work.
No such lock is held during provider HTTP. Concurrent recovery attempts serialize,
then the second attempt observes terminal state and performs no canonical work.

This conservative A1 implementation serializes canonical handoffs globally with
scheduler mutations. It is a throughput limitation, not a periodic runtime or a
solution to physical HTTP exclusivity. A1 does not add an acquisition heartbeat,
per-request target guards, provider error reclassification or durable budgets.

Retained traversal entries make namespace updates and eligibility scans grow
with stream history. A separately governed retention strategy is needed before
unbounded periodic operation; A1 deliberately does not prune terminal evidence.
Together with global serialization, this is a documented P3 operational limit,
not authorization to activate periodic acquisition.

Completed observations refer to mutable source entities. They remain protected
until canonical disposition or an explicit audited abandonment. No payload
snapshot table is introduced. Operator abandonment intentionally releases that
source basis; it cannot be represented as successful canonical processing.

## Historical-state writer inventory

Production writers are limited to `schedulerService.ts` and
`acquisitionOrchestrator.ts`, plus the new handoff-state service:

| Writer | Envelope protection |
| --- | --- |
| Acquisition final persistence | Same transaction writes pending; generic scheduler replacement preserves the newly written namespace |
| Scheduler commit with historicalStateAfter | Ignores caller namespace and merges authoritative persisted envelope after apply |
| Current/historical reset | Rejects protected handoff anywhere in the link; preserves terminal entries |
| Activate | Conflict update does not replace historical_state |
| Pause/resume/deactivate/championship enable-disable | Does not overwrite historical_state; acquisition barrier remains effective regardless of stream state |
| Resume/rebuild history | Does not overwrite historical_state |
| Season/event resync queue | Spreads existing JSONB and replaces only queue fields |
| Year rollover | jsonb_set changes only queue/year paths |
| Acquisition recent-catchup progression | jsonb_set changes only recent_catchup_queue |
| Orchestrator reactivate | Preserves historical_state |
| Handoff outcome/disposition | Validates and updates only its versioned namespace |

Legacy scheduler fixtures which replace JSONB run on streams without handoff
entries. Acquisition-only Lot 5.6 fixtures retain the required immutable mapping binding
for resumed traversals and now explicitly audit `ABANDONED`
between independent scenarios through a helper restricted to `lot56-*` synthetic
adapters. They never erase envelopes or fabricate canonical success. Production
reset and replacement protections are tested separately with protected entries.

## Deterministic validation

`bash scripts/test-r1a1-handoff-recovery.sh` starts only a new local PostgreSQL
container, with synthetic credentials, an isolated database, owned cleanup and
no provider transport. It refuses inherited database, Docker and provider-key
configuration. It builds the API and runs the dedicated integration suite.
No worker or scheduler process is launched.

The suite covers final-commit atomicity, fresh-process offline recovery,
terminal-persistence failure rollback, reviews, normalization/publication errors,
kill switch pause/resume, current/historical replacement barriers, pre-leased
commit rejection, concurrent recovery, exact replay counts, administrative writer
preservation and explicit audited blocked-work disposition. Existing F5-7D tests
remain the regression proof for reconciliation rollback and immutable revisioned
normalization decisions. Unit tests reject malformed envelopes and namespace
injection.

D1 evidence, normalizer identity rules, migration 0041 and canonical handoff order
are preserved. This slice supplies primitives only: P2-01/P2-02 globally and
R1-P1-01 remain open; A2/A3/A4/A5, D2/E/F and Production gain no authorization.
