# Lot 5.7-P-D — implementation evidence

Date: 2026-08-22
Status: **IMPLEMENTATION COMPLETE — AWAITING MAINTAINER AUDIT**

## Delivered boundary

- definitive read-only `/api/v1` championships, events, meetings and changes
  routes in an isolated Fastify plugin;
- explicit allowlisted public projections over C `public_resource_states`;
- parameterized bounded PostgreSQL reads with stable keyset ordering;
- signed opaque HMAC page and sync cursors, type separation and 2 KiB bound;
- a snapshot change-sequence boundary with concurrent updates replayed through
  `/changes`;
- monotone incremental replay, tombstones and optional `include=data`;
- configurable 90-day sync cursor expiry with HTTP 410/full-resync signal;
- safe structured errors containing `code`, `message` and `request_id`;
- OpenAPI 3.1 contract in `docs/api-v1-preview.openapi.json`.

The plugin is deliberately not registered in `server.ts`. D therefore creates
no external client exposure before gate E supplies authentication, entitlement
and client controls. No E capability is implemented.

## Evidence

- API build and typecheck: PASS;
- API unit suite: 267/267 PASS;
- targeted public/security suite: 30/30 PASS;
- ESLint API source/tests: PASS;
- `scripts/test-lot57pd-preview-api.sh`: PostgreSQL D01-D14 PASS;
- `scripts/test-lot57pc-publication.sh`: C01-C35 PASS;
- migrations: NONE;
- provider calls: 0;
- provider credits: 0.

Maintainer validation is not claimed. 5.7-P-E/F, full Lot 5.7, Lot 5.8+ and
merge main remain unauthorized.
