#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
PROJECT="${PREPROD_TEST_PROJECT:-mse-preprod-readiness}"
PORT_BASE="${PREPROD_TEST_PORT_BASE:-55600}"
PASSWORD="${PREPROD_TEST_PASSWORD:-portable-readiness-only}"
ENV_FILE="$(mktemp /tmp/mse-preprod-env-XXXXXX)"
BACKUP_FILE="$(mktemp /tmp/mse-preprod-backup-XXXXXX.sql.gz)"
export COMPOSE_PROJECT_NAME="${PROJECT}"

cleanup(){
  docker compose --env-file "${ENV_FILE}" -f docker-compose.yml -f docker-compose.preprod.yml down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "${ENV_FILE}" "${BACKUP_FILE}"
}
finish(){
  status=$?
  if [[ ${status} -ne 0 ]]; then
    docker compose --env-file "${ENV_FILE}" -f docker-compose.yml -f docker-compose.preprod.yml logs api 2>/dev/null || true
  fi
  cleanup
  trap - EXIT
  exit "${status}"
}
trap finish EXIT INT TERM

cat >"${ENV_FILE}" <<EOF
COMPOSE_PROJECT_NAME=${PROJECT}
PREPROD_POSTGRES_VOLUME=${PROJECT}_postgres_data
POSTGRES_DB=motorsports_events
POSTGRES_USER=mse
POSTGRES_PASSWORD=${PASSWORD}
POSTGRES_PORT=${PORT_BASE}
DATABASE_URL=postgresql://mse:${PASSWORD}@postgres:5432/motorsports_events
API_HOST_PORT=$((PORT_BASE+1))
WEB_HOST_PORT=$((PORT_BASE+2))
VITE_API_URL=http://127.0.0.1:$((PORT_BASE+1))
ADMIN_AUTH_SECRET=portable-test-admin-secret-at-least-32-characters
ADMIN_SESSION_SECRET=portable-test-session-secret-at-least-32-characters
ADMIN_WEB_ORIGIN=http://127.0.0.1:$((PORT_BASE+2))
ADMIN_COOKIE_SECURE=true
TRUST_PROXY_CIDRS=127.0.0.1
PREVIEW_API_ENABLED=false
PREVIEW_CURSOR_SECRET=portable-cursor-secret-at-least-32-characters
PREVIEW_API_KEY_PEPPER=portable-key-pepper-at-least-32-characters
APP_VERSION=$(tr -d '\r\n' < VERSION)
GIT_SHA=$(git rev-parse HEAD)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

compose(){ docker compose --env-file "${ENV_FILE}" -f docker-compose.yml -f docker-compose.preprod.yml "$@"; }

docker compose --env-file "${ENV_FILE}" -f docker-compose.yml -f docker-compose.preprod.yml down --volumes --remove-orphans >/dev/null 2>&1 || true
CONFIG="$(compose config)"
if grep -q 'host_ip: 0.0.0.0' <<<"${CONFIG}"; then
  echo 'PostgreSQL or a preproduction service is publicly bound.' >&2; exit 1
fi
grep -q 'host_ip: 127.0.0.1' <<<"${CONFIG}"

compose build api web >/dev/null
compose up -d --wait postgres
compose run --rm migrate >/dev/null
compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from schema_migrations where version in('0028_lot57pe_client_security','0029_lot57pe_canonical_championship_entitlements')" | grep -qx 2

# Current DB 0024 -> 0025, with legacy data retained.
compose exec -T postgres psql -U mse -d motorsports_events -c "update events set description='preprod-preserved' where id='evt-001'" >/dev/null
compose run --rm migrate sh /migrations/migrate.sh down 0027_lot57pc_public_resource_history >/dev/null
compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null
compose run --rm migrate >/dev/null
compose exec -T postgres psql -U mse -d motorsports_events -Atc "select (description='preprod-preserved')::int from events where id='evt-001'" | grep -qx 1

compose up -d --wait api web
curl -fsS "http://127.0.0.1:$((PORT_BASE+1))/health/live" | grep -q '"git_sha":"'"$(git rev-parse HEAD)"'"'
curl -fsS "http://127.0.0.1:$((PORT_BASE+1))/health/ready" | grep -q '"status":"ok"'
curl -fsS "http://127.0.0.1:$((PORT_BASE+1))/metrics" | grep -q '^motorsports_postgres_ready 1$'
curl -fsS "http://127.0.0.1:$((PORT_BASE+2))/" >/dev/null

# Portable durable-state sentinel: state, revision, change, tombstone and rebuild checkpoint.
compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at,removed_at)
values('event','57000000-0000-4000-8000-000000000901','f1',3,'active','{"name":"Preproduction sentinel"}',repeat('a',64),'2026-08-22T00:00:00Z',null),
      ('event','57000000-0000-4000-8000-000000000902','f1',2,'removed',null,repeat('b',64),'2026-08-22T00:00:00Z','2026-08-22T00:00:00Z')
on conflict do nothing;
insert into public_change_log(sequence,resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at)
values(9001,'event','57000000-0000-4000-8000-000000000901',3,'updated','{name}',repeat('a',64),'2026-08-22T00:00:00Z') on conflict do nothing;
insert into publication_rebuild_checkpoints(scope_key) values('preproduction-readiness') on conflict do nothing;
select setval('public_change_sequence',greatest((select max(sequence) from public_change_log),1));
SQL

compose restart postgres
compose up -d --wait api web
compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from public_resource_states where resource_id in('57000000-0000-4000-8000-000000000901','57000000-0000-4000-8000-000000000902') and revision in(2,3)" | grep -qx 2
compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from public_change_log where sequence=9001" | grep -qx 1

# Backup and restore into a disposable database without replacing the source DB.
compose exec -T postgres pg_dump --no-owner --no-privileges -U mse motorsports_events | gzip -9 >"${BACKUP_FILE}"
gzip -t "${BACKUP_FILE}"; test -s "${BACKUP_FILE}"
compose exec -T postgres dropdb -U mse --if-exists motorsports_events_restore
compose exec -T postgres createdb -U mse motorsports_events_restore
gzip -dc "${BACKUP_FILE}" | compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events_restore >/dev/null
compose exec -T postgres psql -U mse -d motorsports_events_restore -Atc "select count(*) from schema_migrations where version in('0028_lot57pe_client_security','0029_lot57pe_canonical_championship_entitlements')" | grep -qx 2
compose exec -T postgres psql -U mse -d motorsports_events_restore -Atc "select count(*) from public_resource_states where resource_id='57000000-0000-4000-8000-000000000901' and revision=3" | grep -qx 1
compose exec -T postgres psql -U mse -d motorsports_events_restore -Atc "select count(*) from public_change_log where sequence=9001" | grep -qx 1
compose exec -T postgres psql -U mse -d motorsports_events_restore -Atc "select count(*) from provider_source_entities" | grep -Eq '^[0-9]+$'

echo 'VPS preproduction portable readiness: PASS'
echo 'PROVIDER_CALLS=0'
echo 'PROVIDER_CREDITS=0'
