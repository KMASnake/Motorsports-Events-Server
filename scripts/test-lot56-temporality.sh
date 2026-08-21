#!/bin/sh
set -eu

PROJECT=${LOT56E_PROJECT:-mse-lot56-temporality}
POSTGRES_PORT=${LOT56E_POSTGRES_PORT:-55479}
PASSWORD=${LOT56E_POSTGRES_PASSWORD:-lot56-temporality-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

echo 'Démarrage PostgreSQL jetable Lot 5.6-E...'
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0022_lot56_temporality_finalization >/dev/null
docker compose run --rm migrate psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -c \
  "select end_estimation_details from provider_source_entities" >/dev/null 2>&1 && {
    echo 'Le rollback 0022 devait retirer end_estimation_details.' >&2
    exit 1
  }
docker compose run --rm migrate >/dev/null
docker run --rm --network "${PROJECT}_default" -e DATABASE_URL="$DATABASE_URL" \
  -v "$PWD":/source:ro -w /tmp/project node:22-alpine sh -lc '
    cp -a /source/. .
    npm ci >/dev/null
    npm run build --workspace @mse/api >/dev/null
    node scripts/validate-lot56-temporality.mjs
  '
echo 'Recette temporalité/finalization Lot 5.6-E : OK'
