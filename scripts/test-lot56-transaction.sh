#!/bin/sh
set -eu

PROJECT=${LOT56C_PROJECT:-mse-lot56-transaction}
POSTGRES_PORT=${LOT56C_POSTGRES_PORT:-55477}
PASSWORD=${LOT56C_POSTGRES_PASSWORD:-lot56-transaction-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

echo 'Démarrage PostgreSQL jetable Lot 5.6-C...'
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker run --rm --network "${PROJECT}_default" \
  -e DATABASE_URL="$DATABASE_URL" \
  -v "$PWD":/source:ro -w /tmp/project node:22-alpine sh -lc '
    cp -a /source/. .
    npm ci >/dev/null
    npm run build --workspace @mse/api >/dev/null
    node scripts/validate-lot56-transaction.mjs
  '

echo 'Recette transactionnelle Lot 5.6-C : OK'
