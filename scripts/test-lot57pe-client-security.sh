#!/bin/sh
set -eu
PROJECT=${LOT57PE_PROJECT:-mse-lot57pe-client-security}
POSTGRES_PORT=${LOT57PE_POSTGRES_PORT:-55492}
PASSWORD=${LOT57PE_POSTGRES_PASSWORD:-lot57pe-client-security-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
sql(){ docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0028_lot57pe_client_security'")" = 1 ]
docker compose run --rm migrate sh /migrations/migrate.sh down 0028_lot57pe_client_security >/dev/null
[ "$(sql "select to_regclass('public.api_clients') is null")" = t ]
docker compose run --rm migrate >/dev/null
node scripts/validate-lot57pe-client-security.mjs
if docker compose run --rm migrate sh /migrations/migrate.sh down 0028_lot57pe_client_security >/dev/null 2>&1; then
  echo '0028 populated rollback should have been refused' >&2
  exit 1
fi
[ "$(sql "select count(*) from api_clients")" = 1 ]
echo '0028 fresh/down/up and populated rollback protection: PASS'
