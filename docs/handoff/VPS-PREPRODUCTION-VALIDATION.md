# VPS preproduction A/B/C — maintainer validation

DATE: **2026-08-22**
SHA: **cb7d04795b156dc23af6c57efe2bce788569e3da**
ENVIRONMENT: **Debian GNU/Linux 13.6 VPS, x86_64**
RESULT: **PASS**

## Runtime and checkout

- Docker 29.6.2; Docker Compose 5.3.1;
- checkout `/home/debian/motorsports-events-server-preprod` on
  `codex/lot-5-providers-sync` at the exact SHA above;
- NVM 0.40.6, Node 22.23.2 and npm 10.9.8; `npm ci` and API build PASS;
- `npm audit`: 0 vulnerabilities.

No credential, environment value, token or private address is recorded here.
The untracked VPS environment file is mode 600 and ignored locally by Git.

## Isolation and permanent stack

The obsolete Lot 4.2/4.3 test containers, projects, networks, volumes and images
were removed (all resulting counts: 0) without affecting production.

Permanent Compose project `mse-preprod`:

- `mse-preprod-postgres-1`: healthy, bound only to `127.0.0.1:5433`;
- `mse-preprod-api-1`: healthy, bound only to `127.0.0.1:3101`;
- `mse-preprod-web-1`: healthy, bound only to `127.0.0.1:3100`;
- no `0.0.0.0` or public IPv6 preproduction binding;
- persistent volume `mse_preprod_postgres_data` mounted after restart/reboot.

VPS_SECURITY_BOUNDARY: **PASS**
SECRETS_COMMITTED: **NO**
SECRETS_EXPOSED_IN_EVIDENCE: **NO**

## Migration and health

Fresh real VPS database migration 0001→0025: **PASS**. Migration head:
`0025_lot57pc_publication_state`.

Validated C tables:

- `public_resource_states`;
- `public_change_log`;
- `publication_controls`;
- `publication_rebuild_checkpoints`;
- `publication_receipts`.

The portable readiness script ran on VPS with exit code 0. API and Web builds,
current-database upgrade, restart, persistence, healthchecks, backup and
disposable restore passed. Temporary containers, networks, volumes and ports
were fully cleaned afterward.

Permanent API health returned HTTP 200 with database check true. Permanent Web
returned HTTP 200. PostgreSQL, API and Web remained healthy after a real stack
restart and migration 0025 remained present.

## Backup, reboot and persistence

A real `pg_dump | gzip` backup was created outside the repository. Gzip
integrity and migration 0025 presence in the dump passed.

A complete VPS reboot was executed. Production and preproduction restarted
automatically; no manual `docker compose up` was required. PostgreSQL, API and
Web returned healthy. Bindings remained loopback-only and the persistent volume
remained mounted.

The permanent preproduction C state before and after reboot was identically:

```text
public_resource_states | public_change_log | publication_controls | publication_receipts | publication_rebuild_checkpoints
0                      | 0                 | 1                    | 0                    | 0
```

VPS_REBOOT_TEST: **PASS**
VPS_PERSISTENCE: **PASS**
VPS_BACKUP: **PASS**

## Canonical C functional validation

`scripts/test-lot57pc-publication.sh` ran on the VPS in the disposable
`mse-lot57pc-publication` project and returned:

```text
Lot 5.7-P-C PostgreSQL publication: PASS
C01-C35 publication/transaction/rebuild boundary: PASS
EXIT_CODE=0
```

Coverage included first/atomic publication, concurrent and idempotent replay,
unchanged no-op, revision/change sequence, review/LKG, injected rollback,
cancelled update, kill switch/resume, permanent tombstone/no resurrection,
from-scratch and incremental rebuild convergence, and pre-1970 data.

The disposable C environment was fully removed and did not mutate permanent
preproduction state.

VPS_FUNCTIONAL_C: **PASS**
VPS_C01_C35: **PASS**
PROVIDER_CALLS: **0**
PROVIDER_CREDITS: **0**

## Production non-regression and capacity

The existing production stack remained operational before and after reboot.
Its canonical `/api/v1/health` returned HTTP 200; the root returned HTTP 200,
version 2.7.0, and Grafana passed. A prior `/health` 404 on that historical
stack was a route mismatch, not a defect.

After stabilization, approximately 2.6 GiB of 3.7 GiB RAM and 22 GiB of 40 GiB
disk remained available. No swap change is required by this validation.

VPS_PRODUCTION_NON_REGRESSION: **PASS**

## Verdict

VPS_PREPRODUCTION_A_B_C: **VALIDATED**
VPS_PREPRODUCTION_READINESS: **PASS**
VPS_REBOOT_TEST: **PASS**
VPS_PERSISTENCE: **PASS**
VPS_SECURITY_BOUNDARY: **PASS**
VPS_BACKUP: **PASS**
VPS_FUNCTIONAL_C: **PASS**
VPS_C01_C35: **PASS**

This validation authorizes no client exposure and no merge. It is the accepted
operational prerequisite for the separate authorization of 5.7-P-D.
