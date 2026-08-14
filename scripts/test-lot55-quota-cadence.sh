#!/bin/sh
set -eu
PROJECT=${LOT55_PROJECT:-mse-lot55-quota};POSTGRES_PORT=${LOT55_POSTGRES_PORT:-55475};PASSWORD=${LOT55_POSTGRES_PASSWORD:-lot55-quota-test};export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD" DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1||true; };trap cleanup EXIT INT TERM;cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose build api >/dev/null
docker compose run --rm -T -v "$PWD/scripts:/app/scripts:ro" api node scripts/validate-lot55.mjs
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "select 'Migration 0013 et surfaces quota : OK' where exists(select 1 from schema_migrations where version='0013_provider_quota_cadence') and to_regclass('public.provider_request_charges') is not null;"
docker compose run --rm migrate sh /migrations/migrate.sh down 0013_provider_quota_cadence >/dev/null
docker compose run --rm migrate >/dev/null
echo 'Tests Lot 5.5 quotas et cadence : OK'
