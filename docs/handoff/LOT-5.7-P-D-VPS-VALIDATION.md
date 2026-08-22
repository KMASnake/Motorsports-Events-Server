# Lot 5.7-P-D — VPS preproduction validation protocol

Status: **READY FOR MAINTAINER EXECUTION — NOT YET VALIDATED**

This protocol targets only `/home/debian/motorsports-events-server-preprod` and
Compose project `mse-preprod`. It must not mutate or restart Production. Set
`EXPECTED_SHA` to the final SHA reported by the D implementation handoff.

## 1. Preconditions and baseline

```sh
cd /home/debian/motorsports-events-server-preprod
EXPECTED_SHA='<FINAL_SHA_FROM_D_HANDOFF>'
test "$(git branch --show-current)" = codex/lot-5-providers-sync
test -z "$(git status --porcelain)"
git fetch origin codex/lot-5-providers-sync
test "$(git rev-parse origin/codex/lot-5-providers-sync)" = "$EXPECTED_SHA"
df -h /
free -h
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect --format '{{.State.Health.Status}}' motorsports-events-api
docker inspect --format '{{.State.Health.Status}}' mse-preprod-postgres-1
docker inspect --format '{{.State.Health.Status}}' mse-preprod-api-1
docker inspect --format '{{.State.Health.Status}}' mse-preprod-web-1
```

Stop if the checkout is dirty, Production is not healthy, or the remote SHA is
not the audited SHA. Record `ss -lnt` and verify that ports 3100, 3101 and 5433
appear only on `127.0.0.1`, never `0.0.0.0` or `[::]`:

```sh
ss -lnt | grep -E ':(3100|3101|5433)[[:space:]]'
! ss -lnt | grep -E '(0\.0\.0\.0|\[::\]):(3100|3101|5433)'
```

## 2. Safe backup and documented restore

```sh
umask 077
install -d -m 700 /home/debian/backups/mse-preprod
BACKUP="/home/debian/backups/mse-preprod/before-lot57pd-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker exec mse-preprod-postgres-1 pg_dump -U mse -d motorsports_events | gzip -9 > "$BACKUP"
chmod 600 "$BACKUP"
test -s "$BACKUP"
gzip -t "$BACKUP"
ls -l "$BACKUP"
```

Restore is an explicit maintainer action after stopping only preproduction API
and Web. Create a replacement database first; do not overwrite Production:

```sh
gunzip -c "$BACKUP" | docker exec -i mse-preprod-postgres-1 \
  psql -v ON_ERROR_STOP=1 -U mse -d '<EMPTY_PREPROD_RESTORE_DATABASE>'
```

## 3. Fast-forward update and targeted rebuild

```sh
git checkout codex/lot-5-providers-sync
git merge --ff-only origin/codex/lot-5-providers-sync
test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"
test -z "$(git status --porcelain)"
COMPOSE='docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml'
$COMPOSE build api
$COMPOSE up -d --no-deps api
```

Never use `git reset --hard` and never run `down --volumes`. The persistent
volume `mse_preprod_postgres_data` must remain attached.

## 4. Health and schema

```sh
$COMPOSE ps
$COMPOSE exec -T postgres pg_isready -U mse -d motorsports_events
$COMPOSE exec -T postgres psql -U mse -d motorsports_events -Atc \
  "select version from schema_migrations order by applied_at desc limit 1"
curl -fsS http://127.0.0.1:3101/health
test "$(docker inspect --format '{{.State.Health.Status}}' motorsports-events-api)" = healthy
```

Expected migration head remains `0025_lot57pc_publication_state`; D adds no
migration.

## 5. Isolated real PostgreSQL D recipe

The canonical recipe creates its own Compose project, database volume and port,
performs no provider call, and removes all temporary resources on exit:

```sh
LOT57PD_PROJECT=mse-lot57pd-vps LOT57PD_POSTGRES_PORT=55490 \
  ./scripts/test-lot57pd-preview-api.sh
docker ps -a --filter label=com.docker.compose.project=mse-lot57pd-vps
docker network ls --filter label=com.docker.compose.project=mse-lot57pd-vps
docker volume ls --filter label=com.docker.compose.project=mse-lot57pd-vps
```

Expected output:

```text
Lot 5.7-P-D PostgreSQL Preview API: PASS
D01-D14 read/filter/snapshot/cursor/change/security boundary: PASS
```

## 6. Permanent preproduction HTTP audit

D deliberately leaves its plugin unregistered until E. Therefore the permanent
server must keep its legacy `/api/v1` behavior and must not publicly expose a
new unauthenticated `/changes` route. Validate the implementation itself with
the isolated recipe above, then audit the existing service:

```sh
curl -i http://127.0.0.1:3101/api/v1/championships
curl -i http://127.0.0.1:3101/api/v1/events
curl -i http://127.0.0.1:3101/api/v1/changes
```

The first two calls remain compatible. `/api/v1/changes` must remain
unavailable until E supplies client authentication and entitlement. The
isolated D recipe audits filters, multiple pages, signed page cursor, forged
cursor, oversized page, mutually exclusive filters, snapshot boundary,
incremental sync, tombstone representation, safe errors and current data.

## 7. Persistence and isolation

Record C state, restart only preproduction, and compare it afterward:

```sh
$COMPOSE exec -T postgres psql -U mse -d motorsports_events -Atc \
  "select count(*) from public_resource_states; select count(*) from public_change_log;"
$COMPOSE restart postgres api web
$COMPOSE ps
$COMPOSE exec -T postgres psql -U mse -d motorsports_events -Atc \
  "select count(*) from public_resource_states; select count(*) from public_change_log;"
docker volume inspect mse_preprod_postgres_data >/dev/null
docker inspect --format '{{.State.Health.Status}}' motorsports-events-api
```

Counts, migration 0025 and volume attachment must persist. Production must stay
healthy throughout; do not touch its database, volume, Caddy configuration or
containers.

## 8. Resources and final evidence

```sh
free -h
df -h /
docker stats --no-stream
ss -lnt | grep -E ':(3100|3101|5433)[[:space:]]'
docker inspect --format '{{.State.Health.Status}}' motorsports-events-api
```

Record the audited SHA, command outputs, D01-D14 result, loopback bindings,
backup path/integrity, before/after counts and Production health. Do not record
secrets or `.env.preprod` values.

## 9. Application rollback

Rollback only after maintainer approval and with a clean checkout:

```sh
cd /home/debian/motorsports-events-server-preprod
ROLLBACK_SHA='<PREVIOUS_AUDITED_SHA>'
git fetch origin codex/lot-5-providers-sync
git checkout --detach "$ROLLBACK_SHA"
COMPOSE='docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml'
$COMPOSE build api
$COMPOSE up -d --no-deps api
$COMPOSE ps
curl -fsS http://127.0.0.1:3101/health
docker inspect --format '{{.State.Health.Status}}' motorsports-events-api
```

D has no migration, so normal application rollback does not restore the
database. Use the verified backup only if an independently demonstrated data
incident requires it. Never use `down --volumes`.

Passing this protocol does not authorize E, client exposure, full Lot 5.7,
Lot 5.8+ or merge main. The maintainer must record a separate audit decision.
