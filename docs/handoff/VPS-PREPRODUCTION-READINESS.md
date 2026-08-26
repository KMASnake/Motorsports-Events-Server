# VPS preproduction readiness — A/B/C internal stack

Date: 2026-08-22  
Status: **REAL VPS VALIDATION PASS — VALIDATED 2026-08-22**

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
- migration runner through `0025_lot57pc_publication_state`;
- versioned release build/install/update machinery and Caddy/TLS material;
- historical backup/restore verification and release rollback conventions.

REUSABLE:

- the existing images, services, default Docker network, migrations, `/health`,
  Web root healthcheck, persistent volume and forward-compatible rollback;
- the C backend recipe for public state, LKG, journal, kill switch and rebuild.

MISSING:

- real VPS address/user/SSH authorization;
- actual preproduction domain/DNS and ACME email when external HTTPS is wanted;
- real secrets stored outside Git and approved provider runtime configuration.

NOT_REQUIRED_YET:

- Preview API, API keys, client auth, entitlements, quotas, client ACP;
- a second reverse proxy, Kubernetes, Prometheus/Grafana expansion or 5.8 work.

## Architecture and services

Use the principal Compose plus `docker-compose.preprod.yml`. The override does
not duplicate services: it binds PostgreSQL/API/Web to loopback only, sets
production mode, restart policies and a stable named PostgreSQL volume.

| Service | Container port | VPS publication | Persistence/readiness |
|---|---:|---|---|
| PostgreSQL | 5432 | loopback only; never Internet | named volume + `pg_isready` |
| migrate | — | none | must finish successfully before API |
| API | 3001 | loopback only | `/health` includes DB check |
| Web | 3000 | loopback only | Nginx root healthcheck |

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
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml images
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml exec -T postgres \
  psql -U mse -d motorsports_events -Atc "select max(version) from schema_migrations"
date -u +%FT%TZ
```

## Installation and migration

Before deployment, create and verify a backup. Then:

```sh
./scripts/build-release.sh
docker compose --env-file .env.preprod --env-file dist/release-build.env -f docker-compose.yml -f docker-compose.preprod.yml config --quiet
docker compose --env-file .env.preprod --env-file dist/release-build.env -f docker-compose.yml -f docker-compose.preprod.yml build --pull
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml up -d --wait postgres
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml run --rm migrate
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml up -d --wait api web
```

Le second fichier d’environnement est généré à chaque release depuis `VERSION`,
le HEAD Git et l’heure UTC. Il ne contient aucun secret et ne doit jamais être
remplacé par des valeurs `unknown` lors de la construction des images API/worker.

Migration head must be `0025_lot57pc_publication_state`. DOWN migrations are
never automatic on VPS.

## Health, logs and restart

```sh
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3000/
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml ps
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml logs --since 10m api postgres web
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml restart
```

Docker already rotates JSON logs (`10m`, five files, compressed). Logs must not
contain secrets, raw provider payloads or private corrections.

## Backup, restore and rollback

Before every migration/deployment:

```sh
umask 077
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml exec -T postgres \
  pg_dump --no-owner --no-privileges -U mse motorsports_events | gzip -9 > "backup-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
gzip -t backup-*.sql.gz
```

Restore must first be rehearsed into a disposable database with `createdb`,
`gzip -dc | psql -v ON_ERROR_STOP=1`, then verify migration 0025, source,
normalized identities, public state and change log. Only after explicit
approval may a backup replace the primary database.

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

TLS/DNS status: **BLOCKED UNTIL VPS CONFIGURATION**. No hostname is invented.

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
- [ ] migration 0025
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

Local portable readiness is PASS. Actual VPS Go remains pending the unchecked
host-specific items and maintainer authorization to deploy.
