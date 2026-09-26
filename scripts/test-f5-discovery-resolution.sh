#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-f5-discovery-${RANDOM}-$$"
export POSTGRES_PORT=$((57000 + RANDOM % 1000)) POSTGRES_PASSWORD='f5-discovery-local-test'
compose=(docker compose -p "${PROJECT}" -f "${ROOT}/docker-compose.yml")
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" up -d postgres >/dev/null
for _ in $(seq 1 60);do "${compose[@]}" exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null 2>&1&&break;sleep 1;done
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
sql(){ "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc "$1"; }
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0035_f5_provider_discovery_resolution ]]

# Empty rollback and re-upgrade prove the reversible schema path before any evidence exists.
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0035_f5_provider_discovery_resolution >/dev/null
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0034_f5_canonical_venues ]]
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0035_f5_provider_discovery_resolution ]]

DATABASE_URL="postgresql://mse:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events" \
RUN_F5_DISCOVERY_POSTGRES=1 npm test --workspace @mse/api -- --run tests/championshipDiscoveryResolution.postgres.test.ts

before="$(sql "select count(*) from provider_discovery_observations;select count(*) from championship_discovery_candidates;select count(*) from championship_discovery_decisions;select count(*) from championship_source_links;select count(*) from championship_season_source_links")"
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0035_f5_provider_discovery_resolution >/dev/null 2>&1;then
  echo 'F5-4 DOWN accepted while discovery data exists' >&2;exit 1
fi
after="$(sql "select count(*) from provider_discovery_observations;select count(*) from championship_discovery_candidates;select count(*) from championship_discovery_decisions;select count(*) from championship_source_links;select count(*) from championship_season_source_links")"
[[ "${after}" == "${before}" ]]
[[ "$(sql "select count(*) from pg_trigger where tgname in('provider_discovery_observations_immutable','championship_discovery_decisions_immutable','championship_source_links_immutable','championship_season_source_links_immutable') and not tgisinternal")" == 4 ]]
[[ "$(sql "select count(*) from pg_constraint where conname in('championship_season_source_links_championship_scope_fk','championship_season_source_links_season_scope_fk')")" == 2 ]]
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0035_f5_provider_discovery_resolution ]]
echo 'F5-4 provider discovery resolution PostgreSQL certification: PASS'
echo 'PROVIDER_CALLS=0 PROVIDER_CREDITS=0 WORKER_STARTED=NO SCHEDULER_STARTED=NO PREPROD_ACCESSED=NO PRODUCTION_ACCESSED=NO'
