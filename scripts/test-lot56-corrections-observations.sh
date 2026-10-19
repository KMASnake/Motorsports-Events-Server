#!/bin/sh
set -eu

PROJECT=${LOT56F_PROJECT:-mse-lot56-protection}
POSTGRES_PORT=${LOT56F_POSTGRES_PORT:-55481}
PASSWORD=${LOT56F_POSTGRES_PASSWORD:-lot56-protection-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

echo 'Démarrage PostgreSQL jetable Lot 5.6-F...'
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0023_lot56_source_protection >/dev/null
docker compose run --rm migrate >/dev/null
docker run --rm --network "${PROJECT}_default" -e DATABASE_URL="$DATABASE_URL" -v "$PWD":/source:ro -w /tmp/project node:22-alpine sh -lc '
  set -eu
  cp -a /source/. .
  npm ci >/dev/null
  npm run build --workspace @mse/api >/dev/null
  node scripts/validate-lot56-corrections-observations.mjs phase-a
  node scripts/validate-lot56-corrections-observations.mjs phase-b
'
echo 'Recette corrections/observations Lot 5.6-F : OK'
