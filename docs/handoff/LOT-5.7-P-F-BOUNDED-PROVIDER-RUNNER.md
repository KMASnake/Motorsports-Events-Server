# 5.7-P-F — Bounded one-shot provider runner

Date: 2026-08-25  
Status: **IMPLEMENTED LOCALLY — REAL EXECUTION NOT AUTHORIZED**

## Contract

`provider:acquire-once` is a compiled, explicit maintenance entrypoint. It is
not imported by the API or worker and is absent from Compose startup. It
requires the exact provider instance, provider championship and current stream
UUIDs plus a positive `--max-provider-requests`; there is no default budget.

The run budget wraps the existing quota gate at the provider HTTP boundary.
An allowed request consumes one run slot immediately before the mocked/real
transport is invoked. Request N+1 is refused before transport when the budget
is N. The HTTP helper performs no automatic retry. Every separately attempted
retry must therefore pass both the run budget and durable quota gate again.

The exact stream lease is acquired through `PersistentSchedulerService` with
the existing global/provider concurrency, generation and fencing rules. A new
traversal and its active normalization mapping binding are persisted in one
transaction before the first request. A partial or budget-stopped traversal
cannot enter the canonical handoff. A complete persisted traversal is handed
to `CanonicalAcquisitionPublicationService`; no caller mapping is accepted.

## Safe preflight

Build the API first, then run only this read-only command with non-secret UUIDs:

```sh
npm run build --workspace @mse/api
npm run provider:acquire-once --workspace @mse/api -- \
  --provider-instance-id <provider-uuid> \
  --provider-championship-id <provider-championship-uuid> \
  --stream-id <current-stream-uuid> \
  --max-provider-requests 2 \
  --preflight
```

It reports adapter/state, exact association, current stream, active mapping,
runtime mapping identity, credential presence as a boolean, quota policy,
lease state and Preview control. It never decrypts or prints a secret and ends
with `PROVIDER_CALLS=0`.

Required future F1 state is exactly one active/enabled OCBlackTop instance, one
active `f1` association whose external ID is `formula1`, the explicitly chosen
`current` stream, a valid `series-events-v1` source configuration, an active
0030 mapping and an encrypted `api_key`. The runner never creates or activates
any of these objects and never selects the historical stream.

## Emergency sequence

1. send SIGTERM/SIGINT to the one-shot process;
2. disable the selected provider;
3. pause the selected provider championship/current stream;
4. inspect `sync_streams.lease_owner`, expiry and generation;
5. inspect `provider_request_charges` for the selected provider/stream.

The process stops authorizing requests immediately, drains the current bounded
operation, preserves incomplete traversal state and releases its normal lease.

## Separately gated future execution

Database backup and a successful read-only preflight are mandatory first.
No executable real-call command is recorded here because the maintainer has
not authorized a provider request. At the authorization checkpoint, the
operator must record a small strict integer budget. The eventual command block
must begin exactly with:

```text
EXPECTED_PROVIDER_CALLS=at-most-the-approved-budget
MAX_PROVIDER_CALLS=<strict-positive-integer>
PROVIDER_CREDITS_AT_RISK=<same-strict-upper-bound>
=== REAL PROVIDER CALL — REQUIRES MAINTAINER AUTHORIZATION ===
```

Only then may the preflight command be repeated without `--preflight`. Preview
Production, external onboarding, historical acquisition and merge `main`
remain forbidden.

## Test evidence

- focused Vitest proves budgets 1 and 2 at mocked HTTP, N+1 refusal before
  transport, error charging, no retry, stop-before-next-request and startup
  isolation;
- `scripts/test-lot57pf-bounded-provider-runner.sh` provides isolated
  PostgreSQL certification for preflight, exact targeting, mapping binding,
  incomplete traversal, unchanged publication and successful two-page handoff;
- all provider transports in these tests are mocks; external calls/credits are
  zero.

The isolated Docker recipe is PASS locally for scenarios A–H. It does not
authorize a real provider call or replace separate VPS/maintainer validation.
The safe patch transfer, detached worktree, execution and cleanup procedure is
documented in `LOT-5.7-P-F-BOUNDED-RUNNER-VPS-CERTIFICATION.md`.
