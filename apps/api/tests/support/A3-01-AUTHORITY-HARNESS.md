# A3-01 — authority contract and isolated concurrency harness

Scope: explicit maintainer authorization of 16 October 2026 on
`75d8eb80e3a2d12b6792e544a7f3b8ffaab8c916`. This is a test model, not a
production admission service. R1-A2.4 remains certified with its reservations
at `049ddbf00db4fd6beb44c4b4e33cdcc74a1a273a`. R1_P1_01 stays OPEN.
No governance/certification state or global A3 authorization is changed.

Design inputs: PRR-02-A3-ARCHITECTURE, PRR-02-HTTP-FENCING-DESIGN,
PRR-02-IMPLEMENTATION-PLAN and PRR-02-DECISION-GATES under
`/home/kmasnake/projects/audits/production-readiness-prr02/`.
The current limited A3-01 authorization supersedes their historical study-only
restriction; it does not accept an operational architecture or authorize A3-02.

## Boundaries

- The source module defines immutable intent/authority contracts, exact decimal
  generations (no Number conversion), explicit epochs/incarnations, admission
  and execution ports. Acquisition, discovery and dedicated manual identities
  are distinct. A caller identity is separate from the untrusted intent.
- The executable double lives only in test support. It uses one shared in-memory
  owner and a deterministic clock. Snapshot/check/claim are synchronous in the
  model. Promises/barriers choose an interleaving without sleeps or real network.
- The test-owned transport oracle independently records invocation and receipt;
  it does not reuse the authority guard. Its event snapshots cannot mutate its log.
- One intent cannot be consumed twice in the shared model. A provider has at most
  one in-flight request. UNKNOWN prevents automatic replay/successor admission.
  Restart starts CLOSED. No journal, quota refund, operator resolution, external
  isolation proof, credentials or real authentication implementation is provided.
- Before dispatch, refusal/cancellation is not-sent. Once DISPATCHING is uncertain,
  interruption conservatively yields UNKNOWN. An initial reservation has no
  effect on existing A2 retry/quota counters: no A2 component is connected.
- A response is not permission to persist business data. Every result explicitly
  keeps businessPersistenceAuthorized=false. Real A2 guards remain required.

## Coverage and limits

HF01/02/04/05/07 have deterministic model tests; parts of HF03/06/08/09/12/13
are covered for revocation, single-owner serialization, heartbeat uncertainty,
interruption, exact identity and separate next-page intents. These are not
full production HF certifications or multi-process/network tests.

The adversarial AFTER_LAST_LOCAL_CHECK hook intentionally suspends between the
last check and invocation. Expiry/revocation during that suspension can still
produce a late invocation. An already-invoked simulated remote can receive after
cancellation. These tests MUST pass by observing the limitation, not by asserting
that a DB check followed by fetch prevents every late byte/remote acceptance.
No bound on arbitrary suspension, physical exactly-once or remote fencing is proven.

No PostgreSQL authority store, durable quota/attempt journal, socket/TLS/DNS policy,
service ACL, multi-process fencing, automatic failover, real recovery or HTTP
implementation exists here. HF10/11/14/15/16 and complete HF08/09/13 need later
separately authorized lots. Two independently constructed open doubles are not
fenced. Constructor opt-in OPEN_FOR_SIMULATION is fixture setup, not an operational
permission. Manual network execution is represented but deliberately unsupported.

Run: `npm test --workspace @mse/api -- --run tests/executionAuthorityContract.test.ts`.
An independent audit should challenge every barrier, exact expiry, duplicate claims,
late receipt, UNKNOWN replay and the explicit post-check counterexample; inspect
that no runtime caller imports these interfaces and no existing A1/A2 file changed.
It must not close R1_P1_01 or start A3-02 on these simulated results.

## Targeted corrections after independent audit (A3-01-CORR)

IA-A301-01: execution phase, ownership and active transport tracking are private.
Returned execution snapshots (including RESERVED/DISPATCHING and inspect) are
frozen copies. Finishing a request cannot release another intent's domain or an
active transport; UNKNOWN is not overwritten by a late response. CE01's exact
mutation/aborted-duplicate/second-intent sequence must keep maxActive=1.

IA-A301-02: every executor clock observation must be a finite safe integer;
monotonic time is nonnegative. Backward observations, exceptions, invalid expiry
and unsafe deadline/difference arithmetic return invalid_time, never a default.
Before dispatch execute returns CANCELLED_NOT_SENT; admit returns accepted=false.
No reservation is stranded by a clock exception. DeterministicClock refuses
arithmetic overflow without changing either clock. This does not detect an
unobserved clock change during the intentionally exposed post-check window.

IA-A301-03: accepted=true means authority was revalidated NOW, even for an existing
RESERVED intent. Revocation, exact expiry and supersession reject replay without
transport. The historical reservation is not itself a new permit. Terminal states
return already_claimed from admit; execute may return a cached terminal result,
which still never authorizes business persistence or another invocation.

IA-A301-04: provider, season, work class and every acquisition/discovery identity
join the mismatch tests. The season comparison is already correct; a mutation
removing it, made ONLY in an external copy, must be killed by the new season test.
The original 55 cases remain present. The independent property tests are replayed
outside the repository; characterization tests expecting the OLD vulnerabilities
must fail after correction, not be relabeled as successful safety tests.

These corrections do not implement runtime fencing, A3-02, durable storage or a
physical transport. R1_P1_01 remains OPEN; independent re-audit is still required.

## CORR2 — terminal cancellation during the final asynchronous read

Each execution consumer holds a private, opaque claim scoped to its stored attempt.
A terminal transition invalidates that claim permanently. All terminal outcomes are
absorbing, including on late read rejection. After asynchronous preparation, dispatch
requires the same attempt, RESERVED phase, original claim, current provider ownership
and an un-aborted signal. The final comparison and transition have no intervening
await. A stale continuation neither reclaims a released domain nor releases its
successor. Public snapshots remain frozen copies, not ownership capabilities.

Exact independent RE01 and RE02 probes are retained as regression tests. Additional
barriers cover late resolution/rejection, cancellation then replacement, a successor
still RESERVED, authority revocation/supersession, exceptions and terminal replay.
The post-check physical counterexamples remain intentional; this correction concerns
cancellation during the authority await BEFORE the final local transition only.

## CORR3 — intent lifecycle before reservation

Identity is intentId bound to an immutable canonical payload (including authority
identity/generation). A changed payload under that ID is identity_mismatch and
cannot overwrite its stored outcome. Wrong callers cannot install tombstones.

The state machine distinguishes preparation from ownership:

| From | Event | To / effect |
| --- | --- | --- |
| ABSENT (including asynchronous admission preparation) | Authenticated execute observes cancellation | CANCELLED_NOT_SENT tombstone; no domain acquired/released |
| ABSENT | Successful current admission with free domain | RESERVED; acquire provider domain synchronously |
| ABSENT | Admission refusal | No reservation; an admission decision is not a terminal execution record |
| ABSENT | execute returns not-sent for invalid time | CANCELLED_NOT_SENT tombstone, same replay rule |
| RESERVED | Cancellation, preparation error/deadline or execution refusal | Terminal CANCELLED_NOT_SENT/DENIED; invalidate claim, release own domain |
| RESERVED | Current authority, original claim, domain ownership, valid time and signal | DISPATCHING, synchronously |
| DISPATCHING | Response / uncertain exception or interruption | RESPONSE / UNKNOWN; UNKNOWN closes domain |
| Any stored terminal | Replay or late continuation | Same terminal; never RESERVED/DISPATCHING again |

All CANCELLED_NOT_SENT results are recorded before return, even when no reservation
existed. Admission rechecks the stored identity/terminal after its awaits, including
when the authority read failed. Execute also observes that terminal before handling
admission failure or acquiring its execution claim. A signal aborted during admission
is checked on resumption before further execution. No abort listener or settlement
latency bound is promised while a synthetic reader remains indefinitely pending.

Tombstones own no provider domain. Cancellation of a different intent cannot release
an active owner; fresh IDs may proceed only after ordinary authority/domain checks.
A pre-admission DENIED result (wrong caller, identity mismatch, domain busy, authority
refusal) remains a refusal, not an installed reservation. This correction does not
make all such refusals durable. Once stored, terminal records are never removed or
reused during the shared executor lifetime. Retention is unbounded in this finite
test model: no eviction, persistent journal or restart replay guarantee is provided.
The existing CLOSED-on-restart and physical fencing limitations remain unchanged.
