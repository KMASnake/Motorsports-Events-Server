# R1-A2.4-P2-01 — current targeted retry outcome

Scoped correction contract on certified A2.3 base
`e18728f81f1db1386a90f4bd9a3b7940bf71d6a4`, tree
`0b0555f898acc46877af07279416f6119ae6b75e`.
This artifact specifies the correction; it does not grant maintainer validation,
production authorization, or cumulative A2.4 certification.

## Cause and guard

`recordUnitFailure` previously ignored every local/adapter failure when the
unit was already `retry_wait` or `quota_wait`. That guard preserves HTTP outcomes
already recorded atomically by quota accounting, including their retry deadlines,
and prevents unqualified late failure recording from replacing a waiting outcome.
However, a successfully activated targeted retry retains its previous waiting
state until an emitted outcome arrives. Pre-emission cancellation or configuration
failure therefore left the unit due after restart.

The guard remains for callers without current targeted execution authority.
Activation captures the existing unit row as PostgreSQL JSON text, inside the
activation transaction and existing logical claim. It also carries the existing
stream, traversal, run, worker and lease generation. Outcome recording locks the
stream, then traversal, then unit, and checks the unexpired lease, current running
run/traversal, unit association and `ACQUIRING` handoff entry. The waiting-state
guard can be bypassed only if the locked unit still matches the activation snapshot.
A subsequent HTTP/quota disposition or duplicate recorded disposition changes
that snapshot and remains authoritative. Snapshot comparison happens in PostgreSQL
text, preserving timestamp precision rather than round-tripping through JS Dates.
No durable column, generation, schema version, or external-call fence is added.

Blocking adapter failures record the unit disposition before closing the traversal,
in the same transaction, so authority is checked while the traversal is running.
Partial outcomes record inside the existing scheduler commit transaction, before
its run/lease release. Untargeted acquisition and post-fetch persistence error
paths retain their existing behavior.

## Derived transition matrix

`RW` means `retry_wait` with the existing A2.2 backoff and maximum applicable
quota/Retry-After deadline. `keep` preserves the durable state and metadata.
`PF` means `permanent_failure`, `AF` means `auth_failure`.

| Durable state | Caller abort | Configuration | Auth | Permanent HTTP | 429 | Retryable 5xx | Timeout | Network | Internal/accounting/callback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ready | paused | PF | AF | PF | RW | RW | RW | RW | PF |
| retry_wait, current unchanged execution | paused | PF | AF | PF | RW | RW | RW | RW | PF |
| quota_wait, current unchanged execution | paused | PF | AF | PF | RW | RW | RW | RW | PF |
| retry_wait/quota_wait, stale or changed outcome | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| paused | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| permanent_failure | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| auth_failure | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| exhausted | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| succeeded | keep | keep | keep | keep | keep | keep | keep | keep | keep |

For a supplied execution context, stale authority is rejected even in `ready`.
The existing no-context `ready` path remains unchanged. Five confirmed attempts
retain the existing exhaustion rule; terminal success remains protected.
Local `quota_deferred` always preserves the quota service's disposition, including
indefinite fail-closed waits. Request-budget exhaustion/cancellation remains paused.
Pre-emission AUTH entries describe structured adapter classifications, not a real
HTTP response received without emission.

## Regression evidence and boundaries

The scoped PostgreSQL cases live in
`apps/api/tests/acquisitionRetryResume.postgres.test.ts` under the `A2.4` name.
Run them first using the same owned disposable PostgreSQL setup as
`scripts/test-r1a23-acquisition-retry.sh`, with Vitest `-t A2.4`; then run that
script without the filter for all A2.3 regressions.

The original cancellation reproduction uses a pre-aborted signal through the
real HTTP wrapper with a simulated transport. The configuration reproduction uses
`ProviderConfigurationError` before that wrapper. Both initial waiting states are
covered, with zero charges, zero transport emissions, unchanged confirmed attempt
count, and newly constructed services reading durable non-selectable dispositions.
The matrix also covers auth/permanent/transient/internal structured pre-emission
outcomes. Regression cases preserve terminal states, reject stale execution context,
retain newer confirmed HTTP dispositions, and check duplicate outcome idempotence.
Existing A2.3 cases cover max-one logical activation, checkpoint supersession,
post-claim identity checks, microsecond pagination, and A1 handoff ownership.

MAX_EMITTED_ATTEMPTS remains 5. Confirmed and indeterminate charge accounting,
post-emission abort health neutrality, taxonomy, migration 0042, dependencies,
and scheduler policy are unchanged. This correction does not implement A3 physical
provider-call fencing, association generations, heartbeat, periodic budgets or a
periodic retry loop. R1-P1-01 remains for A3; no operational authorization follows.


## A2.4-P2-02 — authority after lock waits

The initial lease check is an early refusal, not final mutation authority.
Targeted activation commits before adapter execution while retaining the session
logical claim. Local outcome recording then acquires the stream row, validates
owner/generation/expiry, locks the running traversal, and locks the retry unit.
Terminal, association, handoff and activation-snapshot guards are unchanged.
The transition re-reads the already-owned unit lock and reads deadline projections
before computing the disposition. These asynchronous boundaries precede the
mutation; an expiration checked before them can become stale while waiting.

A synchronous authorization callback therefore re-reads the existing injectable
clock immediately before the disposition UPDATE, after those locks, reads and
policy calculation. The held stream/traversal/unit locks protect the checked
identity and handoff state from application-authorized supersession; all runtime
sync-run writers take the stream lock. No new locks or lock-order inversion are
introduced. Time remains the condition requiring a fresh check. The convention
matches the scheduler: `now >= lease_expires_at` is expired, including equality.
Current owned-but-expired authority raises the existing `stale_worker`/409 refusal,
both at the initial check and at the final mutation boundary. Noncurrent owner/run
and terminal/snapshot protections still refuse replacement of newer durable truth.

An expired final check throws before any disposition UPDATE. Existing partial
scheduler-commit and blocking-failure transactions roll back before changing the
unit or closing its traversal. The later scheduler failure cannot undo a previously
committed unauthorized unit disposition because none has been written. Charge rows
and confirmed attempt counts are untouched by this failure-recording path.
Untargeted and authoritative charge-outcome transitions do not receive this callback.

Focused deterministic PostgreSQL cases hold either the retry-unit or traversal
row on another connection, observe the actual blocker in `pg_stat_activity`, advance
only the injected clock to expiration minus one millisecond, equality, or plus one
millisecond, and release the row lock. Both `retry_wait`/`quota_wait` and genuine
pre-emission caller-abort/configuration failures are covered. Expired cases preserve
the entire unit row and roll back traversal closure; valid controls persist the
expected dispositions. No real-time sleep is used to expire a lease. Additional
cases cover duplicate outcomes concurrent with scheduler recovery and expiration
during deadline/policy calculation, ensuring the check stays at the UPDATE boundary.
The P2-01 restart/terminal/older-run and A2.3 concurrency/handoff probes remain part
of the same suite. Run `-t 'A2.4'` before the complete PostgreSQL gate.

This correction adds no migration, generation, physical HTTP fence, heartbeat,
periodic execution or A3 redesign. Arbitrary out-of-band SQL supersession after
activation remains outside certified application-level guarantees. This contract
and its tests do not constitute independent maintainer or cumulative certification.

## A2.4-P2-03 — transaction commit authorization

The pre-UPDATE guard does not authorize the remainder of the failure transaction.
In the blocking-failure path, retry disposition and traversal failure metadata are
written before an association-wide anomaly UPSERT. Two legitimate targeted
resumes on current/historical streams can contend on the same active anomaly key.
The lease can expire during that awaited UPSERT even though the unit UPDATE was
authorized. A later scheduler refusal cannot undo a committed disposition.

`recordUnitFailure` now returns its synchronous time-authorization callback to
the transaction owner after checking the current targeted lease, including when
a terminal/changed unit guard preserves the existing disposition.
It still validates immediately before UPDATE. `recordBlockingFailure` calls the
returned guard after the anomaly UPSERT and immediately before issuing COMMIT.
The caller-abort/partial path passes the same guard to the existing scheduler
transaction helper, which invokes it after all apply/run/checkpoint writes and
immediately before issuing COMMIT. The callback adds no query, lock or awaited
operation. Stream/traversal/unit authority locks and the logical session claim
remain held. No lock order, scheduling policy or public failure category changes.

At that precise commit-authorization boundary, `now >= expires_at` throws the
existing `stale_worker`/409 error. The owning transaction catches it, awaits
ROLLBACK, and only then propagates it. Unit disposition, anomaly changes and related
failure metadata roll back together. A returned stale result is never treated as
a successful transaction. The existing outer scheduler failure/lease cleanup is
separate from these writes; an expired lease cannot authorize that cleanup either.
Untargeted callers retain their existing behavior.

This is authorization immediately before commit initiation, not a guarantee that
wall-clock time cannot advance during PostgreSQL's physical COMMIT. No known
application-level awaited/blocking operation remains between the final guard and
issuing COMMIT. The blocking UPSERT and scheduler transaction operation must have
completed first; an exception from either causes the existing rollback path.

Deterministic PostgreSQL regressions use two legitimate targeted resumes sharing
one association, observe the actual second UPSERT waiting in pg_stat_activity,
and delay completion of the first UPSERT without mutating authority. Both source
waiting states and expiry minus one millisecond/equality/plus one millisecond are
covered. Expired cases compare complete unit/traversal rows and all anomalies;
valid controls commit both dispositions and exactly two anomaly occurrences.
Caller-abort cases advance the injected clock after the final scheduler write and
verify rollback of disposition and partial traversal metadata at equality/expiry.
Actual SQL errors injected before the unit UPDATE, after it, and at the anomaly
UPSERT prove rollback of all disposition writes. Every case preserves zero
charges and zero emitted attempts. Run Vitest `-t 'A2.4 P2-03'`, then `-t A2.4`
and the full A2.3 disposable PostgreSQL gate.

No migration, 0042 change, physical HTTP fence, association generation, heartbeat,
periodic consumer or A3 work is introduced. These proofs are local correction
evidence; independent audit and maintainer validation remain separate steps.

## A2.4-P2-04 — explicit refusal after application recovery

A missing/replaced lease owner used to return normally from `recordUnitFailure`.
The blocking-failure owner then closed the recovered traversal and inserted an
anomaly before its later scheduler failure returned `stale_worker`. Unit guards
alone therefore did not protect transaction-wide failure metadata.

The internal execution guard now throws the existing `stale_worker`/409 error for
missing/replaced owner, generation, expiry, active run/traversal or ACQUIRING
handoff authority. A missing/mismatched targeted unit also refuses explicitly.
An authoritative disposition returns its existing synchronous commit guard;
terminal, changed-snapshot and quota-owned outcomes remain legitimate no-ops
with that guard. Untargeted no-context calls preserve their previous semantics.
No public classification or new durable token is introduced.

Every production caller was traced: partial failures use the scheduler transaction;
blocking failures own their BEGIN/ROLLBACK/COMMIT; cursor-invalid result and
post-fetch persistence-failure owners previously omitted targeted context. These
last two now validate the same execution before metadata writes and before COMMIT,
while retaining their original no-context disposition policy. Their waiting-outcome
semantics are unchanged. The shared internal guard performs the existing stream
then traversal locking; unit accounting locks still follow them. No lock order or
scheduler recovery algorithm changes.

A thrown authority refusal enters each owner's existing rollback catch before any
outer propagation. The original recovery test uses only `scheduler.recover()` at
injected expiry and then resumes the old adapter with a pre-emission configuration
error. Fresh reads preserve the recovered unit, partial traversal, stream/run rows
and absence of anomalies. The matrix includes caller abort, network and local quota
failure from both waiting states. Post-fetch/cursor-invalid recovery and valid-owner
controls cover the other metadata owners without altering disposition policy.

Recovery uses SKIP LOCKED: while a failure owns the stream and waits for the retry
unit or anomaly persistence, recovery cannot remove that lease. Deterministic tests
observe the actual unit/anomaly blocker, verify recovery returns zero, advance the
clock, and release contention. The existing final guards then roll back the outcome;
recovery succeeds after the transaction releases its stream. Before-anomaly and
after-anomaly/pre-authorization synchronization also proves this serialization.
No wall-clock sleeps expire leases. Existing P2-01/02/03 valid and expired controls,
terminal/idempotence, pagination, checkpoint, handoff and claim regressions remain
required. Run the A2.4 filter followed by the complete disposable PostgreSQL gate.

The commit boundary remains the synchronous guard after the last blocking write
and before COMMIT initiation, with `now >= expires_at` stale. Physical COMMIT does
not freeze time. No migration, 0042 change, recurring consumer, physical-call fence,
heartbeat, association-generation redesign or A3 implementation is introduced.
Local correction evidence is not independent maintainer certification.

## A2.4-P2-05 — targeted success commit authorization

A targeted successful result previously entered the scheduler commit transaction
without its final authorization callback. A retry-unit lock wait in completeUnit
could outlast the lease after the scheduler's initial check and still publish
checkpoint/run completion.

The targeted success apply callback now captures the existing execution guard
before applying source/traversal writes. It checks current owner, generation,
run/traversal and ACQUIRING handoff under the existing stream/traversal locks.
The target unit association and logical identity are those verified by targeted
activation, retained by the logical claim and application checkpoint/stream locks.
Its synchronous time guard is mandatory at final commit authorization: a missing
captured guard refuses as stale_worker. The check runs after all source, unit,
run and checkpoint operations and immediately before COMMIT initiation. Expiry
(including equality) throws through the owning rollback before propagation; no
successful checkpoint/run/unit/traversal changes survive. Own successful traversal
completion or handoff preparation is not mistaken for external authority loss.
Untargeted acquisitions do not require this targeted callback and retain their
existing behavior. No new lock or accounting policy is introduced.

Regression cases observe actual completeUnit row-lock contention and cover valid,
equal and expired leases, with both complete/partial results and zero/one simulated
emissions. Valid controls preserve the existing unit completion policy, while stale
cases compare full stream/run/unit/traversal/anomaly rows after rollback. Independent
zero-emission reproduction preserves page:1 and running and returns stale_worker.
Application recovery and actual SQL errors in application, checkpoint and unit
completion are also covered. Sovereign confirmed charges remain accounted; rollback
of acquisition success never invents an emission refund. P2-01 through P2-04 remain
covered by the A2.4 filter and full PostgreSQL regression gate.

This is a scoped success-path correction, not a certification of every scheduler
transaction exit. No migration, 0042 change, provider execution, periodic consumer,
physical-call fence, heartbeat or A3 implementation is introduced.
