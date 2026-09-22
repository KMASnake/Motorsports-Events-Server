# VPS preproduction readiness — Node preproduction operations

Date: 2026-09-22
Status: **F3 PROVEN — F4 OPERATIONS HARDENING IN PROGRESS**

The maintainer completed the real VPS checklist on Debian 13.6 at deployed SHA
`cb7d04795b156dc23af6c57efe2bce788569e3da`. The permanent preproduction stack,
full reboot, persistence, isolation, backup and canonical C01–C35 recipe passed.
See `VPS-PREPRODUCTION-VALIDATION.md` for the immutable evidence record.

This is an internal preproduction environment, not Production Preview and not
a client-ready deployment. It exposes no new route or client control.

## DEPLOYMENT_INVENTORY

EXISTING:

- `docker-compose.yml`: PostgreSQL 17, one-shot migrator, Fastify API and Nginx Web;
- existing API/Web Dockerfiles, named PostgreSQL volume, service healthchecks
  and Docker JSON log rotation;
- migration runner through `0031_real_circuit_reference_data`;
- versioned release build/install/update machinery and Caddy/TLS material;
- historical backup/restore verification and release rollback conventions.

REUSABLE:

- the existing images, services, default Docker network, migrations, `/health`,
  Web root healthcheck, persistent volume and forward-compatible rollback;
- the C backend recipe for public state, LKG, journal, kill switch and rebuild.

NOT RECORDED HERE:

- VPS address, SSH access and secrets, which must remain outside Git;
- current host state beyond the maintainer-validated evidence referenced by
  `PROGRESS.json` and the dedicated F3 closure document.

NOT_AUTHORIZED:

- Production Preview activation and external client onboarding;
- provider execution during ordinary operations;
- Lot 5.8+, Production deployment or merge to `main`.

## Architecture and services

Use the principal Compose plus `docker-compose.preprod.yml`. The override does
not duplicate services: it binds PostgreSQL/API/Web to loopback only, sets
production mode, restart policies and a stable named PostgreSQL volume.

The mandatory runtime Compose context is:

- `--env-file .env.preprod`;
- `-p mse-preprod`;
- `-f docker-compose.yml`;
- `-f docker-compose.preprod.yml`.

The mandatory build/release Compose context is:

- `--env-file .env.preprod`;
- `--env-file dist/release-build.env`;
- `-p mse-preprod`;
- `-f docker-compose.yml`;
- `-f docker-compose.preprod.yml`.

`.env.preprod` provides the preproduction runtime configuration.
`dist/release-build.env` provides release/build metadata when the release
workflow requires it; it is not required for ordinary runtime commands.
`docker-compose.preprod.yml` enforces preproduction Web behavior, including an
empty `VITE_API_URL`. Omitting the appropriate context can create a parasite
Compose project, compile the Web with `http://localhost:3001`, recreate the API
with incorrect database parameters, or leave `/health` metadata as `unknown`
when the release build is not used. Never repair such a mistake by changing the
existing PostgreSQL password or volume; remove only the parasite project, then
recreate the intended services with the appropriate complete context.

| Service | Container port | VPS publication | Persistence/readiness |
|---|---:|---|---|
| PostgreSQL | 5432 | loopback only; never Internet | named volume + `pg_isready` |
| migrate | — | none | must finish successfully before API |
| API | 3001 | loopback only | `/health` includes DB check |
| Web | 3000 | loopback only | Nginx root healthcheck |
| Worker | none | none | stopped by default; explicit start only |
| Prometheus | 9090 | no host publication | private scrape + persistent metrics volume |

The future external path, if approved, must reuse the existing Caddy/TLS
architecture and proxy only after real domain parameters exist. Do not expose
the loopback ports directly to the Internet.

## Environment and secrets

Copy `.env.preprod.example` to an untracked, mode-600 file on the VPS. Replace
every `replace-*` value. `POSTGRES_PASSWORD` and the URL-encoded password in
`DATABASE_URL` must represent the same secret. Keep provider keys, admin
secrets, SSH material and ACME account data outside Git.

Record every deployment with:

```sh
git rev-parse HEAD
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml images
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml exec -T postgres \
  psql -U mse -d motorsports_events -Atc "select max(version) from schema_migrations"
date -u +%FT%TZ
```

## Installation and migration

Before deployment, create and verify a backup. Then:

```sh
./scripts/build-release.sh
docker compose --env-file .env.preprod --env-file dist/release-build.env -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml config --quiet
docker compose --env-file .env.preprod --env-file dist/release-build.env -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml build --pull
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml up -d --wait postgres
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml run --rm migrate
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml up -d --wait api web
```

Le second fichier d’environnement est généré à chaque release depuis `VERSION`,
le HEAD Git et l’heure UTC. Il ne contient aucun secret et ne doit jamais être
remplacé par des valeurs `unknown` lors de la construction des images API/worker.

Migration head must be `0031_real_circuit_reference_data`. DOWN migrations are
never automatic on VPS.

The Node application declares that exact ordered migration chain in
`apps/api/src/lib/schemaCompatibility.ts`. `/health/live` only proves that the
API process is alive. `/health/ready` separately verifies PostgreSQL
connectivity, the presence of `schema_migrations`, and exact compatibility with
the application schema head. Missing metadata, an older head, an unknown
version or an incomplete chain fails closed with HTTP 503. The schema guard is
read-only: it observes and refuses; only the separately invoked `migrate`
service applies forward migrations.

The canonical operational scripts use the same context through
`preprod_compose` in `scripts/lib.sh`. `scripts/update.sh` starts only
`postgres`, the one-shot `migrate`, `api`, `web` and `prometheus`; it never
starts `worker`. Starting the worker requires a separate, explicitly authorized
operation. The scripts refuse an inherited `COMPOSE_FILE`, a project name other
than `mse-preprod`, missing Compose files or a missing `.env.preprod`.

## Health, logs and restart

```sh
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3000/
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml ps
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml logs --since 10m api postgres web
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml restart api web prometheus
```

Docker already rotates JSON logs (`10m`, five files, compressed). Logs must not
contain secrets, raw provider payloads or private corrections.

## Backup, restore and rollback

Before every migration/deployment, use `./scripts/backup.sh`. It dumps the
`postgres` service atomically, then `verify-backup.sh` restores the dump into a
uniquely named disposable database and removes that database on exit. The
cleanup is fail-closed.

Equivalent manual backup command:

```sh
umask 077
docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml exec -T postgres \
  pg_dump --no-owner --no-privileges -U mse motorsports_events | gzip -9 > "backup-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
gzip -t backup-*.sql.gz
```

`restore.sh` is deliberately verification-only: it delegates to that disposable
restore path and cannot replace the active preproduction database, stop or
restart API/worker services, reset a database or run a DOWN migration. Any
future primary restore requires a separately reviewed and explicitly authorized
procedure.

Rollback means returning to the previous application/image tag while retaining
the forward-compatible schema. Never automatically run destructive migration
DOWN on a persistent VPS database.

## Backend C validation

Run locally/CI before upload:

```sh
./scripts/test-preproduction-vps-readiness.sh
./scripts/test-lot57pc-publication.sh
```

On VPS, use repository/SQL inspection only: verify source 5.6 → candidate B →
`public_resource_states`, one effective update → one `public_change_log` row,
same-state replay → no row, review candidate → LKG unchanged, kill switch
preservation/resume, and from-scratch/incremental convergence. No client route
is required or authorized.

## Reboot test (not yet executed)

After an initial validated deployment and backup: record UUID/revision/sequence,
reboot the VPS, wait for Docker, verify the named volume is mounted and all
healthchecks are green, then compare source, candidates, public state, LKG,
tombstones, checkpoints and change sequence. Current status: **READY TO TEST ON
VPS**, not PASS ON VPS.

## Firewall and TLS

- deny inbound by default;
- allow SSH only from approved administration sources;
- never allow public TCP/5432, 3001 or 3000;
- allow 80/443 only when a real domain and TLS deployment are approved;
- do not change the real firewall automatically from this repository recipe.

TLS status: **OPERATIONAL AND PREVIOUSLY VALIDATED** for
`preprod.motorsports-events.fr` through the existing Caddy architecture. F4-2
does not access or revalidate the VPS and does not infer any new runtime state.

## Go / No-Go checklist

- [ ] VPS accessible
- [ ] Docker installed
- [ ] Docker Compose 2.24+ available (`!override` support)
- [ ] firewall configured
- [ ] PostgreSQL not publicly exposed
- [ ] domain/DNS if external access is required
- [ ] TLS if external access is required
- [ ] secrets installed outside Git
- [ ] persistent volumes
- [ ] initial backup
- [x] migration 0031
- [ ] healthchecks green
- [ ] restart stack PASS
- [ ] reboot VPS PASS
- [ ] public state C PASS
- [ ] change log C PASS
- [ ] LKG PASS
- [ ] rebuild PASS
- [ ] backup PASS
- [ ] restore PASS
- [ ] no client endpoint exposed

F3 operational closure is proven. F4 hardening remains in progress and this
runbook does not authorize deployment, provider execution, Production Preview,
external onboarding or Production.

F4-0, F4-1 and F4-2 are validated. F4-3 schema compatibility is implemented
locally by this change and remains pending maintainer review; no runtime or VPS
validation is implied.
