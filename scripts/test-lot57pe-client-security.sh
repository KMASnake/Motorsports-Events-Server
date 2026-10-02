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
[ "$(sql "select count(*) from schema_migrations where version in ('0028_lot57pe_client_security','0029_lot57pe_canonical_championship_entitlements')")" = 2 ]
docker compose run --rm migrate sh /migrations/migrate.sh down 0029_lot57pe_canonical_championship_entitlements >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0028_lot57pe_client_security >/dev/null
[ "$(sql "select to_regclass('public.api_clients') is null")" = t ]
docker compose run --rm migrate >/dev/null
[ "$(sql "select data_type from information_schema.columns where table_name='api_client_championships' and column_name='championship_id'")" = text ]

upgrade_client='57000000-0000-4000-8000-000000000901'
upgrade_entitlement='57000000-0000-4000-8000-000000000902'
docker compose run --rm migrate sh /migrations/migrate.sh down 0029_lot57pe_canonical_championship_entitlements >/dev/null
sql "insert into api_clients(id,name) values('$upgrade_client','0029 upgrade fixture'); insert into api_client_championships(client_id,championship_id) values('$upgrade_client','$upgrade_entitlement')"
docker compose run --rm migrate >/dev/null
[ "$(sql "select championship_id from api_client_championships where client_id='$upgrade_client'")" = "$upgrade_entitlement" ]
docker compose run --rm migrate sh /migrations/migrate.sh down 0029_lot57pe_canonical_championship_entitlements >/dev/null
[ "$(sql "select championship_id::text from api_client_championships where client_id='$upgrade_client'")" = "$upgrade_entitlement" ]
docker compose run --rm migrate >/dev/null
sql "delete from api_clients where id='$upgrade_client'"

node scripts/validate-lot57pe-client-security.mjs
[ "$(sql "select championship_id from api_client_championships")" = f1 ]
if docker compose run --rm migrate sh /migrations/migrate.sh down 0029_lot57pe_canonical_championship_entitlements >/dev/null 2>&1; then
  echo '0029 rollback should refuse canonical text entitlements' >&2
  exit 1
fi
sql 'delete from api_client_championships'
docker compose run --rm migrate sh /migrations/migrate.sh down 0029_lot57pe_canonical_championship_entitlements >/dev/null
if docker compose run --rm migrate sh /migrations/migrate.sh down 0028_lot57pe_client_security >/dev/null 2>&1; then
  echo '0028 populated rollback should have been refused' >&2
  exit 1
fi
[ "$(sql "select count(*) from api_clients")" = 1 ]
docker compose run --rm migrate >/dev/null
echo '0028/0029 fresh/upgrade/down/up and populated rollback protection: PASS'
