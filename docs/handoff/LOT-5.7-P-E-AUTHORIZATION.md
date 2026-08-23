# Lot 5.7-P-E — maintainer authorization

Date: **2026-08-23**

## Gate state

A: **MAINTAINER VALIDATED**  
B: **MAINTAINER VALIDATED**  
C: **MAINTAINER VALIDATED / ADDITIVE PUBLIC-HISTORY CORRECTION REVALIDATED**  
D: **MAINTAINER VALIDATED**  
C/D VPS validation: **PASS** at `90e7f7cf5bd975aeb7610c3f98d1dbef0f323b96`

E: **AUTHORIZED FOR IMPLEMENTATION — NOT YET VALIDATED**

F: **UNAUTHORIZED**  
Full 5.7: **UNAUTHORIZED**  
5.8+: **UNAUTHORIZED**  
Merge main: **UNAUTHORIZED**

## Maintainer decision

The maintainer explicitly authorizes implementation of **5.7-P-E — Client security, entitlements, limits and minimal ACP**.

This authorization follows the maintainer validation of 5.7-P-D and the successful VPS validation of the additive 5.7-P-C public-history correction and D read/sync boundary. It authorizes E implementation only; it does not validate E in advance and does not authorize gate F, Production launch, external client onboarding, full Lot 5.7, Lot 5.8+, or merge to `main`.

## Authorized E scope

The normative E acceptance is **PP-T29 through PP-T35** plus functional **PP-105 through PP-135 and PP-180**.

Authorized capabilities:

- API clients independent from administrative authentication;
- strong-random Bearer API-key lifecycle;
- one-time display of complete key material;
- HMAC-SHA-256 digest storage with an off-database pepper;
- constant-time key verification;
- multiple active keys for controlled rotation;
- immediate key revocation and client suspension/reactivation;
- four read scopes separated from championship entitlement;
- F1 championship entitlement for the Preview vertical;
- authorization re-evaluated on every request and cursor continuation;
- 403 for explicit unauthorized scope/dataset access and 404 for inaccessible individual UUIDs;
- per-client defaults of 60 requests/minute and 10,000 requests/day, configurable;
- atomic counters, UTC daily reset, quota/rate-limit response headers and distinct 429 behavior;
- 304 counted against daily quota and 5xx excluded from daily quota;
- anti-abuse handling for unauthenticated requests where required by the validated design;
- safe request/audit observability with no Authorization value, complete key, digest, pepper or source payload;
- minimal manual ACP operations for client lifecycle, key lifecycle, F1 entitlement and limits;
- secure registration/exposure of the already validated D read-only V1 plugin behind the E controls;
- additive reversible migration(s), repositories, middleware/policies, API/admin minimum and focused security/concurrency tests required to satisfy the above.

## Required invariants

Implementation must preserve all validated A/B/C/D invariants, including:

- private 5.6 source graph and provider payloads;
- deterministic normalized identities and mappings;
- last-known-good publication behavior;
- immutable public history and tombstones;
- snapshot reconstruction and `/changes` semantics;
- retained-journal cursor boundary and HTTP 410 behavior;
- allowlisted public representations with no internal-field leakage;
- stable `/api/v1` compatibility outside the newly protected Preview client boundary;
- production and preproduction separation.

Existing migrations `0025_lot57pc_publication_state`, `0026_legacy_provider_uuid_repair` and `0027_lot57pc_public_resource_history` must not be rewritten. Any need to change the validated C/D model requires a separate maintainer decision.

## Explicitly out of scope

This authorization does **not** include:

- billing or commercial plans;
- self-service client/developer portal;
- public browser API keys;
- complete customer onboarding;
- full ACP/client portal beyond the minimum required by PP-T35/PP-180;
- F1 operational certification gate F;
- Production visibility switch;
- external client onboarding;
- full Lot 5.7 generalization;
- Lot 5.8+;
- merge to `main`.

## Required evidence before maintainer validation

E must stop for maintainer audit after producing reproducible evidence for PP-T29–PP-T35, including at minimum:

- API-key create/show-once/store/verify/rotate/revoke lifecycle;
- proof that raw keys, HMAC digests and pepper never leak through API, logs, audit or UI;
- timing-safe verification tests;
- scope and F1-entitlement separation on collections, details and cursor continuations;
- 401/403/404 anti-enumeration behavior;
- 60/minute and 10,000/day defaults, UTC reset and response headers;
- 304 charging, 5xx non-charging and concurrent atomic limit enforcement;
- client suspension/reactivation;
- minimal ACP client/key/entitlement/limit operations;
- negative security tests for malformed credentials, enumeration, cursor abuse and secret redaction;
- non-regression of C01–C35 and D01–D20;
- API typecheck/lint/tests/build and existing Playwright/CI baseline;
- disposable PostgreSQL migration fresh/upgrade/DOWN/UP evidence;
- a documented VPS validation protocol for subsequent maintainer execution;
- zero real provider calls and zero provider credits unless separately authorized.

## Stop rule

After implementation, tests, evidence and push, stop for maintainer audit.

Do **not** begin 5.7-P-F. Do **not** switch Preview visibility in Production. Do **not** onboard an external client. Do **not** authorize full 5.7 or 5.8+. Do **not** merge to `main`.

## Authorization record

**MAINTAINER AUTHORIZATION: GRANTED — 2026-08-23**  
**AUTHORIZED GATE: 5.7-P-E**  
**IMPLEMENTATION VALIDATION: NOT YET GRANTED**
