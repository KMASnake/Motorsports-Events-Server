# 5.7-P-F — PP-171 certification evidence

Status: **PASS — RUNTIME CERTIFIED — MAINTAINER VALIDATED**

PP-171 is PASS. Gate F is not closed, Production Preview and Production remain
unauthorized, and neither PP-178 nor PP-179 is validated by this certification.

## Validation record

- STATIC DESIGN: **PASS**;
- RUNTIME ATTEMPT #1: **FAIL — application defect detected**;
- HEADER FIX: **PASS**;
- RUNTIME ATTEMPT #2: **PASS**;
- MAINTAINER VALIDATION: **PASS**;
- PP-171: **PASS**.

Attempt #1 correctly detected that a minute-limit rejection returned
`X-DailyLimit-Remaining: 100` after two consumed daily requests instead of the
required value `98`. It produced no PASS artifact and cleanup completed with
zero residual containers, networks and volumes. The application correction
also fixed the statically confirmed minute remaining value after compensation
of a rejected daily-quota reservation.

Attempt #2 passed at Git SHA
`4e37a8edeed3f22e61d9ba7e0ddda2e6d4b39b92`, version
`8.1.0-alpha.2-lot.4.4`, certified at `2026-08-31T14:58:08.432Z`.

## Static design

`scripts/test-lot57pf-pp171.sh` generates an immutable-format project name with
the reserved `mse-lot57pf-pp171-<24 lowercase hex>` pattern. Operator project,
Compose file, database URL and Docker host/context overrides are refused. The
only accepted Docker endpoint is the local default Unix socket.

Every Compose command explicitly uses `/dev/null` as env file, the dedicated
`docker-compose.lot57pf-pp171.yml`, and the generated project name. That file
contains only disposable PostgreSQL, a one-shot migration service and a
one-shot certification container. It contains no worker, Web, provider,
scheduler, discovery, Preview Production or preproduction service. PostgreSQL
has no host port and its credentials and URL are generated internally.

The certification container starts a real Fastify listener on a container
socket, waits for readiness through HTTP, then uses real HTTP requests. This is
not a smoke test of the complete deployed API bootstrap: the certification
server explicitly assembles the real Preview routes, Preview security service
and PostgreSQL repository required by PP-171. Its only Docker network is an
`internal: true` network shared with disposable PostgreSQL; provider egress is
therefore unavailable at runtime. No provider credential is mounted or passed.

## Certified PP-123–PP-132 coverage

- two keys of client A share the same per-client minute counter;
- client B proves counter isolation;
- allowed and rejected responses prove configured limits, HTTP 429,
  `rate_limit_exceeded`, `Retry-After` and coherent RateLimit headers;
- daily exhaustion proves `daily_quota_exceeded`, daily headers and the exact
  UTC reset interval;
- an injected clock proves deterministic rollover at 00:00 UTC without changing
  the host clock;
- a `/changes` page containing multiple disposable changes consumes one request;
- a test-local repository failure is armed only after proving both counters are
  zero; the real `onRequest` security hook reserves minute and daily quota, the
  real repository call fails with HTTP 500 `internal_error`, and the real
  `onSend` hook compensates daily quota. The final counters must be minute 1 and
  daily 0; the test performs no compensation itself;
- a concurrent HTTP burst proves atomic enforcement never permits more than the
  configured limit. Every rejected response must independently be HTTP 429
  `rate_limit_exceeded` with the expected limit, remaining, daily and retry
  headers; no other error status can be counted as a valid rejection.

All clients, keys, usage and public fixtures exist only in the disposable
database. No runtime/bootstrap business data is added to the repository.

## Cleanup and evidence

The trap is installed before any Docker operation. Cleanup can address only the
generated project, removes its containers, internal network and volume, then
queries Docker labels to prove that none remain. A cleanup error or residual
resource fails the certification.

Only after all assertions and verified cleanup succeed, the wrapper writes
`dist/certification/lot57pf-pp171-<git-sha>-<run-id>.json`. The finalizer accepts
an exact field schema and rejects credential, secret, Authorization, password,
pepper, nonce, ciphertext, database URL or provider/source payload fields. The
artifact contains only release identity, non-sensitive counts/statuses, cleanup
proof, `provider_calls_external: 0` and `worker_started: false`.

The successful artifact is retained as
`docs/handoff/evidence/lot57pf-pp171-runtime.json`. Its SHA-256 is
`c2e3bae8dbc853931b30fd6c76edafa27b51b622f16693e6e27ac70b5644da2a`,
identical to the generated artifact
`dist/certification/lot57pf-pp171-4e37a8edeed3f22e61d9ba7e0ddda2e6d4b39b92-235902c041fff0d9a20dc739.json`.
It records all twelve assertions as true, zero external provider calls, zero
provider credits, no worker start and verified cleanup with zero residual
containers, networks and volumes.

This evidence validates PP-171 only. It does not validate PP-178, PP-179 or
Gate F, and does not authorize Production Preview, Production, external client
onboarding, another provider call, deployment or merge to `main`.
