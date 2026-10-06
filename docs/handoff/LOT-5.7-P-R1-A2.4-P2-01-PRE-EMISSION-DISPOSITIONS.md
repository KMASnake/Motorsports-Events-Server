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
