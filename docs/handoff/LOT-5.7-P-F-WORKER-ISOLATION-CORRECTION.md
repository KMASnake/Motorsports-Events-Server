# 5.7-P-F prerequisite — API/worker isolation correction

Date: 2026-08-25
Status: **EXIT LOOP CORRECTED LOCALLY — VPS REVALIDATION REQUIRED**

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

The first real VPS audit found the worker restarted approximately every eleven
seconds with exit code 0. The poll timer was deliberately unreferenced for the
historical embedded runtime; once isolated from the HTTP server, no referenced
resource kept the standalone Node process alive.

The runtime now accepts an explicit `keepProcessAlive` option. It remains false
by default and is enabled only by `worker.ts`, keeping poll and heartbeat timers
referenced. Targeted tests prove the worker timer remains referenced between
polls, `stop()` cancels it, graceful shutdown still awaits current work, lease
release remains intact and the API still contains no runtime instance.

WORKER ISOLATION CORRECTION: **COMPLETE**
WORKER EXIT LOOP CORRECTION: **COMPLETE LOCALLY**
VPS REVALIDATION: **REQUIRED**
MAINTAINER AUDIT: **REQUIRED**
FULL 5.7-P-F IMPLEMENTATION AUTHORIZED: **NO**
REAL PROVIDER CALL AUTHORIZED: **NO**
PRODUCTION PREVIEW AUTHORIZED: **NO**
EXTERNAL ONBOARDING AUTHORIZED: **NO**
MERGE MAIN AUTHORIZED: **NO**
