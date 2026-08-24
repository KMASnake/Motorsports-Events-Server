# Lot 5.7-P-E — implementation evidence

Date: 2026-08-24
Status: **INTEGRATION CORRECTION COMPLETE — MAINTAINER/VPS REVALIDATION REQUIRED**

## Delivered boundary

- additive migration 0028 for clients, digest-only keys, scopes, championship
  entitlements and atomic minute/day counters;
- one-time `mse_live_`/`mse_test_` keys, HMAC-SHA-256 with off-database pepper,
  constant-time verification, rotation, revocation and suspension/reactivation;
- secure opt-in registration of the validated D plugin, per-request rights,
  client-bound cursors, collection/change SQL filtering and 401/403/404 rules;
- configurable 60/minute and 10,000/day defaults, UTC buckets, headers,
  distinct 429 errors, charged 304 and daily refund for 5xx;
- minimal admin API for client, key, entitlement, scope and limit lifecycle,
  protected by existing admin auth/CSRF and audit redaction;
- focused HTTP/security tests and disposable PostgreSQL lifecycle/concurrency
  recipe. Provider requests and provider credits remain zero.

## Acceptance

| Criterion | Evidence | Result |
|---|---|---|
| PP-T29 | `previewSecurity.test.ts`; E01-E18 PostgreSQL lifecycle | PASS |
| PP-T30 | entitlement SQL filters and client-bound cursor tests | PASS |
| PP-T31 | 401/403/404 negative HTTP tests | PASS |
| PP-T32 | atomic defaults, UTC buckets, headers and distinct 429 tests | PASS |
| PP-T33 | conditional 304, 5xx refund and six-way concurrent charge | PASS |
| PP-T34 | Fastify/admin-audit redaction plus no-secret DB assertions | PASS |
| PP-T35 | protected minimal admin client/key/rights/status routes | PASS |

## VPS maintainer protocol

On an isolated preproduction checkout of the audited SHA:

1. back up PostgreSQL and record the current migration head;
2. set independent secret values for `PREVIEW_CURSOR_SECRET` and
   `PREVIEW_API_KEY_PEPPER`, keep `PREVIEW_API_ENABLED=false`;
3. run `./scripts/test-lot57pe-client-security.sh`;
4. apply migrations and confirm head `0028_lot57pe_client_security`;
5. enable Preview only on the private loopback preproduction service;
6. create a synthetic F1 client through the protected ACP API, record the key
   once outside logs, then verify 401/403/404, rotation, revoke, suspend,
   reactivate, 429 headers, 304 charging and 5xx non-charging;
7. inspect application and admin audit logs for absence of Authorization,
   complete keys, digest and pepper;
8. disable Preview, retain the forward-compatible schema, and verify C01-C35
   plus D01-D20.

This protocol performs no provider request, no Production visibility switch
and no external client onboarding.

## Reopened validation and integration correction

The local audit initially passed at
`bfe6d4818b105a08417e6c524084cae0a176690d`, but the real VPS validation
reopened E after the complete server exposed duplicate Fastify registrations
for the definitive Event and Championship GET routes.

The correction introduces one Preview-aware resource assembly used by the real
`server.ts`. Preview OFF registers the historical public Event/Championship
reads. Preview ON omits only those four colliding GET handlers, preserves all
historical admin/write handlers, and registers the seven definitive protected
Preview reads. A full assembly regression proves both modes and would fail with
`FST_ERR_DUPLICATED_ROUTE` before the correction.

Local correction evidence:

- full typecheck, lint, 42 Web tests, 277 API tests and builds: PASS;
- real route assembly Preview OFF/ON, seven definitive routes and admin/write
  preservation: PASS;
- PP-T23 through PP-T28 PostgreSQL D01-D20 recipe: PASS;
- PP-T29 through PP-T35 PostgreSQL E01-E18 recipe: PASS;
- migration 0028 fresh/down/up and populated rollback protection: PASS;
- repository validation, release build, extracted validation and tests: PASS;
- real provider calls and provider credits: 0.

These are local correction results only. They do not constitute maintainer or
VPS revalidation.

Evidence retained from the VPS run:

- GitHub CI and security/code review: PASS;
- PP-T29 through PP-T35: PASS;
- applicable PP-105 through PP-135 and PP-180: PASS;
- E01-E18 key lifecycle, rights, suspension and atomic limits: PASS;
- migration 0028 fresh/down/up and populated rollback protection: PASS;
- real provider calls: 0;
- provider credits consumed: 0.

PRIOR AUDITED SHA: **bfe6d4818b105a08417e6c524084cae0a176690d**
MAINTAINER REVALIDATED: **NO**
VPS REVALIDATED: **NO**

5.7-P-F, Production Preview activation, external client onboarding, full Lot
5.7, Lot 5.8+ and merge main remain unauthorized.
