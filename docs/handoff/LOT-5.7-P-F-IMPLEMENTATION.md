# 5.7-P-F — Implementation evidence

Date: 2026-08-25  
Status: **IMPLEMENTED LOCALLY — MAINTAINER/VPS/PROVIDER EVIDENCE REQUIRED**

## Authorized scope delivered

- deterministic controlled F1 replay from durable 5.6 source rows through
  normalization, publication, HTTP API and `/changes`;
- stable UUID, idempotent replay, monotone revision/sequence, persistent
  override, cancellation, kill switch and last-known-good evidence;
- distinct `/health/live` and `/health/ready`, with readiness independent from
  external providers;
- bounded Prometheus metrics for availability, latency, 5xx, 429 and
  PostgreSQL readiness; no credentials, request bodies or source payloads;
- runtime release metadata (`version`, Git SHA, build time) and the same fields
  embedded in the release ZIP;
- corrected canonical text championship identifier in OpenAPI;
- portable Docker/PostgreSQL staging proof at migration head 0029, including
  restart persistence and full restore into a distinct database.

No migration was added. Preview remains false by default. No real client was
onboarded and no real provider was called.

## Local evidence

- `scripts/test-lot57pf-certification.sh`: PASS, controlled F1 fixture/replay,
  provider calls/credits 0;
- `scripts/test-preproduction-vps-readiness.sh`: PASS, Docker staging,
  live/ready/metrics, migrations, restart and backup/restore;
- complete 5.4, 5.5 and 5.6-A–F PostgreSQL recipes: PASS, provider calls and
  credits 0;
- targeted health/metrics tests, API typecheck and lint: PASS;
- OpenAPI JSON, Compose config, shell syntax and `git diff --check`: PASS.

The previously validated E security evidence remains authoritative and was not
needlessly rerun. The validated API/worker isolation prerequisite also remains
authoritative.

## Evidence still requiring separate authority or environment

PP-T36 cannot be declared fully PASS from fixtures alone because its normative
wording requires a real F1 acquisition. The prohibited call would be:

- provider: OCBlackTop;
- endpoint: `GET https://api.ocblacktop.com/v1/formula1/events` with bounded
  `page`, `limit=100` and `year` query parameters;
- credential: an OCBlackTop API key injected through the encrypted provider
  configuration; never written to Git or command history;
- calls/cost: one provider request/credit per returned page, total unknown
  until the provider's terminal pagination evidence is received; the operator
  must set and record an explicit call/credit ceiling before execution;
- expected data: current F1 Event identifiers, timestamps, statuses and
  explicit pagination termination, persisted by 5.6 then replayed through the
  deterministic F certification;
- risks: quota consumption, provider outage/schema drift and accidental live
  secret disclosure;
- rollback: suspend the configured provider championship, stop the worker,
  revoke/rotate the test credential, retain the last-known-good public state
  and remove only synthetic client/key material.

PP-163, PP-165/166 and PP-179 also require real environment evidence. The
Production smoke is prohibited while Production Preview is unauthorized.
PP-178 needs two explicitly selected release images for the genuine
`N -> N+1 -> N` application rollback; local migration down/up and restart
proof is not mislabeled as that release rollback.

## Gate state

- PP-T36: controlled deterministic substitute PASS; normative real-provider
  evidence pending authorization;
- PP-T37: pending the real/VPS/Production-only criteria above;
- PP-T38: local Docker/PostgreSQL/backup/restore PASS; TLS and genuine release
  rollback require VPS/release evidence;
- PP-T39: PASS with zero real provider calls/credits;
- PP-T40: pending exact final release SHA and remaining mandatory evidence.

5.7-P-F is not maintainer validated. Production Preview, external onboarding,
full Lot 5.7, 5.8+ and merge main remain unauthorized.
