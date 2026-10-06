# R1-A2.2 — Durable acquisition retry state

## Scope and ownership

This contract defines persistence/admission primitives, not a retry executor.
A2.3 due selection/resumption, A3 physical request exclusivity/heartbeat
(R1-P1-01), and A4 periodic acquisition remain separate. Project authorizations
and maintainer validation remain exclusively in `PROGRESS.json`.

## Schema and logical identity

Additive migration `0042_acquisition_retry_state` follows the inspected 0041
head. It creates `provider_acquisition_retry_units` and the charge reservation /
idempotency link `provider_acquisition_retry_charges`. Existing rows are not
rewritten. The application schema guard requires 0042. DOWN refuses while any
retry unit exists, preserving durable history; it can remove empty new tables.

A logical unit is a traversal plus a canonical SHA-256 digest of its input
cursor, work class, season and safe-unit key. Provider and stream are explicit
foreign keys; traversal retains work/season/run/lease linkage. No raw URL,
credential, body or arbitrary exception message is persisted. Cursor input is
hashed rather than copied. Future A2.3 must reuse this traversal/unit identity,
not create a new traversal to reset the retry budget. A later successful current
refresh has its own traversal and therefore its own budget.

Quota-backed acquisition creates the unit in the traversal-start transaction,
and binds the existing one-shot quota gate (including its strict manual budget)
to it for the page. Discovery and connection tests are not acquisition units.
Synthetic adapters without a quota-backed gate do not claim emitted accounting.

## State machine

- `ready`: unit opened, or successful HTTP outcome awaiting acquisition commit.
- `retry_wait`: retryable rate limit / HTTP transient / network / timeout failure.
- `quota_wait`: pre-emission quota/cadence refusal; deadline may be unknown.
- `paused`: caller cancellation, manual budget stop, or provider unavailable.
- `auth_failure`: HTTP 401/403; no automatic retry.
- `permanent_failure`: other HTTP, TLS/security, payload/configuration or internal
  failures requiring operator intervention; no automatic retry.
- `exhausted`: emitted budget reached following failures; no automatic retry.
- `succeeded`: source acquisition outcome committed successfully.

Terminal dispositions remain terminal even if another previously reserved
request later succeeds; truthful emitted accounting still advances. At five,
failed/terminal units become exhausted. Success of the logical acquisition
closes `ready` atomically with source/checkpoint persistence. A repeated HTTP
outcome never changes state or timestamps. Quota deferral preserves a prior
retry deadline. An admission deadline check refuses an early request; it does
not find due work or activate/resume acquisition.

## Attempts, quota and transactions

Policy `acquisition_retry_v1` fixes `max_emitted_attempts=5`. Authoritative
`emitted_attempt_count` advances only on the sovereign
`provider_request_charges.emitted=true` transition, in the SAME transaction as
quota outcome and provider/stream health updates. The link's charge primary key
and counted flag make concurrent/repeated outcomes idempotent. This link is not
a quota ledger: window consumption, observations and charge emission remain
owned by quota/cadence.

Before charge authorization, the existing provider quota runtime lock and a
retry-unit row lock serialize admission. Count plus unsettled charge reservations
cannot exceed five; concurrent authorization cannot create a sixth reserved
slot. An authorization not emitted retains count zero; `markNotEmitted` releases
its slot through the existing emitted=false charge transition. A crash with an
unknown emission leaves its reservation blocked, not guessed as emitted or
reclaimed. Automatic recovery of ambiguous requests is not implemented here.

Outcome operations for linked charges acquire the same quota runtime lock before
retry unit mutation. Charge, count, disposition and health all rollback together
if persistence fails. Adapter/local failure dispositions are persisted in the
existing acquisition outcome transaction where that boundary allows it; scheduler
failure remains its existing separate transaction. The original typed A2.1
classification is preserved, with category/code/status and normalized Retry-After
state/deadline. No new scheduler eligibility state/query is introduced.

Cancellation already known before authorization or before fetch emits nothing,
refunds an already granted authorization if necessary, and consumes no attempt.
A local counter callback failure also releases its un-emitted authorization.
The strict manual request budget delegates this cancellation idempotently.
After emission, caller abort counts, persists `paused`, retains the quota charge,
and preserves the certified A2.1 health-neutral exception and prior backoffs.
Local validation, scheduler refusal and provider pause consume no emitted attempt.

## Deadlines and bounded policy

Local delay is 30 seconds for HTTP transient (408/425/5xx), network and timeout,
60 seconds for 429, multiplied by `2^(emitted_attempt_count-1)` and bounded at
one hour. The injected jitter is nonnegative additive, at most 10 seconds and
never exceeds the remaining space below the one-hour local cap. Invalid jitter
fails the transaction. Tests inject zero or a fixed value.

`next_retry_at = max(local_backoff_until, valid Retry-After deadline,
applicable quota/provider/stream deadline)`. The quota constraint uses the
existing runtime backoff/next-eligible and stream backoff, exhausted configured
windows, minimum request cadence and reliable exhausted provider observations
with a reset deadline. An exhausted provider observation with unknown reset
persists `quota_wait` with no deadline rather than inventing eligibility.
This projection reads the sovereign quota tables; it creates no second ledger. Pre-emission refusals
store the authoritative quota decision deadline. Quota remains independently
sovereign at every authorization; stored metadata never grants a quota bypass.
A longer quota deadline may exceed the one-hour local backoff cap.

A2.1 normalized Retry-After is used for 429 and 503 (and other classified HTTP
transients where supplied). A short/past/invalid Retry-After cannot shorten local
backoff. Existing global quota/cadence health policies are not redesigned.
Network category is retryable even though its diagnostic retryHint is unknown;
this is the authorized bounded A2 retry policy, not a claim that every network
failure is transient. Other unknown/internal outcomes require operator action.

## Barriers and validation

`canonical_handoff_v1`, its state machine and replay/resume semantics are untouched.
Offline handoff recovery remains provider-free. No retry selection query, automatic
transition back into acquisition, recurring timer, worker, migration on a real
DB, provider call, credentials, preprod/production access or deployment is needed.

Run `bash scripts/test-r1a22-acquisition-retry.sh` for a cached-image, loopback-only,
owned disposable PostgreSQL test. It covers fresh application through 0042,
empty rollback/reapplication, repeated migration runner, non-destructive populated
rollback refusal, actual quota-gate/acquisition integration, emitted distinctions,
deadlines, separate-process reload, duplicate/distinct concurrency and max budget.
The harness rejects inherited real DB/Docker/credential settings and verifies
owned container/network/volume cleanup. Existing A2.1, A1, acquisition/scheduler,
quota, repository, schema, typecheck/lint/build/governance and dependency audit
remain required. Successful local tests are candidate evidence, not maintainer
validation or A2.3/A3/A4 authorization.

Observed local candidate validation:

- A2.2: 34 PostgreSQL tests passed, including independent-process reload,
  reservation/outcome races, rollback and a preexisting HANDOFF_BACKOFF envelope.
- A2.1: 63 unit cases and 11 PostgreSQL accounting cases passed; A1: 31 passed.
- Acquisition/scheduler regressions and 64 quota scenarios passed, plus 40 existing
  normalization/publication cases and 14 F5-7D handoff cases on synthetic data.
- API: 599 passed / 134 default PostgreSQL skips; web: 119 passed.
- Repository: 193 tests / 18 skips; graph 0001..0042 and application contract passed.
- Workspace typecheck/lint/build and governance validation passed.
- `npm audit --audit-level=high`: exit 0; two previously accepted moderate findings
  remain. Certified package metadata/lockfile and Vitest 3.2.7 / Tinypool 2.1.2
  override are unchanged.
- Disposable resources were removed. No provider call, real credential/DB access,
  worker/scheduler daemon, preprod/production access, deployment or push occurred.
