# 5.7-P-F prerequisite — API/worker isolation correction

Date: 2026-08-25
Status: **CORRECTION COMPLETE — MAINTAINER AUDIT REQUIRED**

## Authorization boundary

The maintainer separately authorized only the runtime isolation correction:

- remove `DiscoverySchedulerRuntime` from the HTTP API process;
- provide a dedicated worker entrypoint and Compose service;
- preserve PostgreSQL leases, fencing, quota/cadence and 5.4–5.6 invariants;
- prove API operation without the worker, independent worker operation and
  graceful shutdown;
- use fixtures/mocks only, with no real provider call and no migration.

Full 5.7-P-F implementation, real provider calls, Production Preview,
external onboarding, full Lot 5.7, Lot 5.8+ and merge main remain unauthorized.

## Implementation

- `server.ts` retains provider administration routes but starts no periodic
  discovery runtime;
- `worker.ts` verifies the versioned schema, registers the existing adapters,
  composes the existing scheduler/discovery/quota services and starts the
  existing `DiscoverySchedulerRuntime`;
- the worker receives database/provider runtime configuration only, exposes no
  port and receives no Preview or administrative session secret;
- SIGTERM/SIGINT stop new polling, await in-flight discovery, close the shared
  PostgreSQL pool and logger, then exit;
- Compose starts API and worker independently after the migration service.

No scheduler, lease, fencing, quota/cadence, adapter or migration behavior was
changed.

## Evidence

- targeted Vitest: 6/6 PASS;
- API typecheck: PASS;
- API lint: PASS;
- `docker compose config`: PASS;
- Docker/PostgreSQL isolated proof:
  - API starts and is healthy without worker: PASS;
  - dedicated worker starts without ports: PASS;
  - SIGTERM logs `Provider worker stopping` then `Provider worker stopped` and
    exits in one second: PASS;
  - API remains healthy after worker shutdown: PASS;
- migrations created or modified: 0;
- real provider calls: 0;
- provider credits: 0.

## Audit state

WORKER ISOLATION CORRECTION: **COMPLETE**
MAINTAINER AUDIT: **REQUIRED**
FULL 5.7-P-F IMPLEMENTATION AUTHORIZED: **NO**
REAL PROVIDER CALL AUTHORIZED: **NO**
PRODUCTION PREVIEW AUTHORIZED: **NO**
EXTERNAL ONBOARDING AUTHORIZED: **NO**
MERGE MAIN AUTHORIZED: **NO**
