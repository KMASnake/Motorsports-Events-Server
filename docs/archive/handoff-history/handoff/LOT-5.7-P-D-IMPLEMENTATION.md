# Lot 5.7-P-D — implementation evidence

Date: 2026-08-22
Status: **PASS — MAINTAINER VALIDATED 2026-08-22**

## Delivered boundary

- definitive read-only `/api/v1` championships, events, meetings and changes
  routes in an isolated Fastify plugin;
- explicit allowlisted public projections over C `public_resource_states`;
- parameterized bounded PostgreSQL reads with stable keyset ordering;
- signed opaque HMAC page and sync cursors, type separation and 2 KiB bound;
- a snapshot change-sequence boundary with concurrent updates replayed through
  `/changes`;
- historical snapshot reconstruction from immutable public versions, including
  concurrent updates and tombstones;
- monotone incremental replay, tombstones and optional `include=data`;
- sync cursor expiry derived from the oldest retained journal sequence, with
  HTTP 410/full-resync signal;
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
- `scripts/test-lot57pd-preview-api.sh`: PostgreSQL D01-D20 PASS;
- `scripts/test-lot57pc-publication.sh`: C01-C35 PASS;
- migration 0027 fresh/upgrade/DOWN/UP: PASS;
- provider calls: 0;
- provider credits: 0.

Maintainer validation is recorded after successful VPS execution at
`90e7f7cf5bd975aeb7610c3f98d1dbef0f323b96`. Migration 0027, historical
multi-page snapshots, concurrent update, tombstone behavior, `/changes`, real
retention boundaries and cleanup all passed. Production remained healthy and
preproduction remained private on loopback.

The oldest guaranteed snapshot is stored separately from the oldest retained
change. Pre-0027 snapshots expire at the migration baseline; change cursors
expire only when their sequence precedes the actual retained journal boundary.
`issuedAt` remains signed cursor metadata but no longer decides retention.

MAINTAINER AUDIT: **PASS**
MAINTAINER VALIDATED: **TRUE — 2026-08-22**

5.7-P-E/F, full Lot 5.7, Lot 5.8+ and merge main remain unauthorized.
