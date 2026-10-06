# R1-A2.3 — Due acquisition retry selection and targeted resume

## Scope

Callable internal primitives only: `AcquisitionRetryResumeService.selectDue(limit)`
`selectDuePage(limit, after)` and `resume(unitId, prepareContext)`. Neither application startup nor an existing
worker invokes them. No route, recurring timer, cron or polling consumer is added.
`prepareContext` supplies validated configuration and credentials for this explicit
invocation; the service does not load provider secrets. Tests supply synthetic
configuration, empty credentials and mocked HTTP transports.

The implementation builds on certified base b4c9919 and migration 0042. No new
migration or durable claim field is needed. Canonical handoff schema and certified
A2.2 policy/accounting/disposition semantics remain unchanged. Authorizations and
maintainer validation remain exclusively in PROGRESS.json.

## Due selection and exact identity

Only `retry_wait` and `quota_wait` with a known `next_retry_at` are considered.
The effective deadline is the maximum of next retry, local backoff, quota deadline,
valid Retry-After, provider runtime backoff/eligibility and stream backoff/eligibility.
Every represented deadline must be satisfied. A null quota-wait deadline remains
blocked. Sovereign quota authorization still checks current configured windows,
observations and cadence immediately before reservation; selection grants no quota
bypass and does not reserve or emit a request.

Count plus unresolved sovereign charge reservations must be less than five.
Succeeded, exhausted, permanent/auth failures, paused and ready are excluded.
The traversal must be incomplete and running/partial/failed, with an active provider,
association and championship and no live stream lease. There is no automatic
administrative resume of disabled/paused associations or providers.

SQL orders by effective deadline then unit UUID and bounds candidates by a required
integer limit in 1..100 (default 10). Decoder/identity/barrier refusals can produce
fewer results than the requested candidate bound; selection does not scan successive
unbounded batches to fill it. `selectDuePage` returns a deadline/UUID keyset cursor
for explicit bounded pagination, including pages emptied by identity/barrier
refusals. Advancing this cursor avoids starvation behind unavailable checkpoints;
no internal paging loop is added. Returned descriptors are hints, never activation tokens.

The current durable stream checkpoint is restored using the registered adapter and
its cursor version. The restored input plus traversal work class, season and safe
unit key must reproduce the certified A2.2 SHA-256 logical identity. The canonical
hash implementation is shared without changing its serialization. A superseded,
invalid or unavailable cursor/adapter is refused; no cursor is guessed, no stream
is reset, and no fresh traversal or retry budget is manufactured. Selection reads
only the current bounded candidates; an unavailable older checkpoint requires
operator disposition rather than reconstruction from an irreversible hash.

Targeted resume processes exactly one adapter work unit on the selected traversal,
not a whole provider/stream or all remaining pages. It preserves the bound mapping,
work class, season and safe-unit key rather than applying a fresh priority/year
selection. Normal scheduler rollover is omitted only for this explicit exact-cursor
activation. A strict five-request invocation ceiling delegates to the existing quota gate;
the sovereign unit ledger further limits it to its remaining safety slots. This
supports an adapter work unit requiring multiple requests without adding a
page/retry loop or creating a new per-invocation logical budget.
The existing orchestrator/transaction service persists source, checkpoint and retry
completion. If that unit completes acquisition, the existing canonical publication
handoff receives the same traversal. Partial progress returns to the caller; no
page/retry loop is added.

## Logical claim and revalidation

A dedicated PostgreSQL connection outside the shared pool acquires `pg_try_advisory_lock(223, hashtext(unitId))`.
Only one concurrent A2.3 invocation for that unit can hold it. Hash collisions
conservatively refuse an unrelated claimant; they do not authorize duplicate work.
The session lock stays held through the one-unit outcome and handoff, and is released
by closing that connection in finally. Claims do not retain shared-pool clients
while waiting for quota/scheduler/source transactions, avoiding pool starvation
under concurrent claims. It is a logical A2.3 claim, not a physical provider HTTP fencing token.

The existing scheduler transaction/serialization root revalidates unit state,
deadlines, budget, traversal, identity and handoff ownership before issuing its
existing stream/run lease. Claim preparation locks the stream with NO KEY UPDATE
before the retry unit, matching outcome stream-to-unit mutation and permitting
charge foreign-key KEY SHARE checks; it does not introduce a unit-to-stream wait.
Failed acquisition traversals become partial for this
same traversal; an eligible error/backoff stream becomes ready inside that same
transaction. If scheduler eligibility/concurrency refuses activation, those changes
rollback. Generic scheduler callers retain their existing scheduling and rollover.

Acquisition initialization locks/revalidates the retry unit again under the existing
handoff serialization root before changing traversal/handoff state or entering the
adapter. The retry ID returned by the certified ensure operation must match the
selected ID. Changed state, deadline, budget, cursor or handoff ownership blocks the
request. Quota admission again enforces the sovereign budget/deadline rules.

## A1 barrier

For the targeted traversal, absent legacy handoff state or valid `ACQUIRING` permits
normal incomplete acquisition. Every other A1 state blocks targeted provider retry:
HANDOFF_PENDING, HANDOFF_BACKOFF, HANDOFF_PAUSED, HANDOFF_BLOCKED, DONE,
DONE_WITH_REVIEW and ABANDONED. Malformed envelopes fail closed. The existing
association-wide pending-handoff barrier also remains effective. Revalidation at
acquisition initialization includes terminal handoff states, preventing a late
claim from overwriting them with ACQUIRING. A1 offline recovery/resume/abandon and
canonical_handoff_v1 schema are not changed.

## Crash and indeterminate emission

- Selected but not claimed: selection has no durable side effects.
- Claimed session, before lease commit: connection/process loss releases the
  advisory lock; the open transaction rolls back and the due unit is retained.
- Existing scheduler lease committed, before provider reservation: process loss
  releases the logical lock. Existing bounded scheduler lease recovery marks the
  run interrupted, retains the traversal/checkpoint and restores eligibility. The
  retry identity/count/deadline is unchanged. There is no new claim lease or timer.
- Reservation committed, emission unknown: A2.2 indeterminate charge links remain
  durable, reserve their safety slots and require explicit evidence disposition.
  Logical/session or scheduler lease recovery cannot refund or count them. At five
  reserved/confirmed slots no further A2.3 selection/admission succeeds.
- Confirmed emission/outcome: the certified atomic quota/retry transaction counts
  once, preserving deadlines/terminal dispositions and caller-abort health neutrality.
- Completed source outcome: checkpoint/retry success persists through the existing
  transaction; success is no longer due. A completed traversal belongs to the
  existing handoff lifecycle, including its offline recovery if publication fails.

A lost database session during a still-running physical request is not a guarantee
that the physical request stops. R1-P1-01 (association/lease loss, heartbeat and
per-request ownership fencing) remains OPEN for A3. This slice introduces no A3
fencing, physical exclusivity, periodic budgets or full lock-order redesign.

A4 periodic consumption is separate: no setInterval, cron, worker startup, automatic
scheduler/retry loop, preprod runtime, production authorization or deployment is added.

## Validation

Run `bash scripts/test-r1a23-acquisition-retry.sh`: owned cached-image PostgreSQL,
loopback-only binding, synthetic data, certified migrations through 0042, rollback/
reapplication, and explicit cleanup verification. Focused tests cover due filters,
ordering/limit, exact one-unit identity, concurrent claim, stale selection, A1 states,
late handoff ownership, emission accounting, quota refusal/abort and crash recovery.
A2.2/A2.1/A1, acquisition/scheduler/quota, repository, typecheck/lint/build, governance
and npm audit high remain required. Local evidence is not maintainer validation.

Observed local candidate evidence:

- A2.3: 53 focused PostgreSQL cases passed, including keyset pagination, twelve
  distinct concurrent claims, an actual killed claim process, late quota outcome,
  multiple HTTP requests within one unit, stale state/deadline/budget and A1 barriers.
- A2.2: 50 PostgreSQL cases; A2.1: classification plus 11 accounting cases;
  A1: 31; quota: 64; acquisition/scheduler and 40 existing canonical pipeline
  cases passed. The existing F5-7D handoff gate passed all 14 cases.
- Repository: 193 tests / 18 skips; API: 599 passed / 203 default PostgreSQL
  skips; web: 119 passed. Workspace typecheck, lint, API/web builds and governance
  validation passed. npm audit high exited 0 with the same two moderate advisories.
- Migration 0042, dependency metadata/lockfile, CI and canonical handoff schema
  are unchanged. Owned disposable resources were removed. No real provider call,
  credential load, worker/scheduler daemon, real DB access, deployment or push occurred.

A checkpoint superseded outside the retry lifecycle cannot be inverted from its
hash. It remains refused; explicit pagination permits selecting later reconstructible
work. This is a fail-closed reconstruction limitation, not permission to reset the
stream or create a new traversal/budget. Local evidence remains a candidate for an
independent maintainer audit, not an operational/production authorization.
