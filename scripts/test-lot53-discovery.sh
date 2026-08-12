#!/bin/sh
set -eu
PROJECT=${LOT53_PROJECT:-mse-lot53-discovery}
POSTGRES_PORT=${LOT53_POSTGRES_PORT:-55473}
PASSWORD=${LOT53_POSTGRES_PASSWORD:-lot53-discovery-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose build api >/dev/null
docker compose run --rm -T -v "$PWD/scripts:/app/scripts:ro" api node scripts/validate-lot53.mjs
docker run --rm -v "$PWD:/source:ro" -w /work node:22-alpine sh -lc '
  cp -a /source/. /work/ && npm ci >/dev/null &&
  npm run typecheck --workspace @mse/api &&
  npm test --workspace @mse/api -- providerDiscoveryAdapters.test.ts
'
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  do \$\$ begin if (select count(*) from information_schema.tables where table_schema='public' and table_name in ('provider_discovered_championships','provider_discovery_runs')) <> 2 then raise exception 'Schéma découverte incomplet'; end if; end \$\$;
  select 'Schéma découverte Lot 5.3 : OK';"
docker compose run --rm migrate sh /migrations/migrate.sh down 0010_provider_discovery_completeness >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0009_provider_discovery >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c \
  "do \$\$ begin if (select count(*) from schema_migrations where version in ('0009_provider_discovery','0010_provider_discovery_completeness')) <> 2 then raise exception 'Réapplication découverte incomplète'; end if; end \$\$;"
echo "Rollback puis réapplication 0009/0010 : OK"
echo "Tests Lot 5.3 découverte : OK"
