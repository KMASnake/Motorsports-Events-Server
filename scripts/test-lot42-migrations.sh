#!/bin/sh
set -eu

PROJECT=${STEP1_PROJECT:-mse-lot42-migrations}
POSTGRES_PORT=${STEP1_POSTGRES_PORT:-55450}
API_PORT=${STEP1_API_PORT:-3441}
WEB_PORT=${STEP1_WEB_PORT:-3440}
PASSWORD=${STEP1_POSTGRES_PASSWORD:-lot42-migration-test}

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT API_HOST_PORT="$API_PORT" WEB_HOST_PORT="$WEB_PORT"
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://localhost:$API_PORT"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

fingerprint() {
  sql "select md5(string_agg(row_to_json(t)::text, '|' order by t.id)) from (select id, timezone, updated_at from events) t"
}

echo "Création d'une base isolée..."
cleanup
docker compose up --build -d

versions=$(sql "select string_agg(version, ',' order by version) from schema_migrations")
[ "$versions" = "0001_event_corrections,0002_utc_storage,0003_admin_audit_and_provider_identity" ]
[ "$(sql "select count(*) from events where timezone <> 'UTC'")" = "0" ]
echo "Versions : $versions"

docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations")" = "3" ]

docker compose run --rm migrate sh /migrations/migrate.sh down 0002_utc_storage >/dev/null
sql "insert into event_corrections(id,event_id,provider_key,field_name,provider_value,override_value,status) values ('migration-timezone-probe','evt-002','legacy','timezone','\"Europe/London\"','\"UTC\"','active')"
docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from event_corrections where id='migration-timezone-probe'")" = "0" ]
[ "$(sql "select count(*) from archived_event_corrections where id='migration-timezone-probe'")" = "1" ]

docker compose run --rm migrate sh /migrations/migrate.sh down 0002_utc_storage >/dev/null
[ "$(sql "select timezone from events where id='evt-002'")" = "Europe/London" ]
[ "$(sql "select field_name || ':' || status from event_corrections where id='migration-timezone-probe'")" = "timezone:active" ]
echo "Rollback et restauration : OK"

docker compose run --rm migrate >/dev/null
before=$(fingerprint)
docker compose restart api >/dev/null
docker compose restart api >/dev/null
after=$(fingerprint)
[ "$before" = "$after" ]
echo "Empreinte inchangée après deux redémarrages API : $after"
echo "Tests des migrations Lot 4.2 étape 1 : OK"
