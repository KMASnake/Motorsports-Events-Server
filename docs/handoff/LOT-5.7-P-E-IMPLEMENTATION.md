# Lot 5.7-P-E — implementation evidence

Date: 2026-08-24  
Status: **IMPLEMENTATION COMPLETE — MAINTAINER AUDIT REQUIRED**

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
