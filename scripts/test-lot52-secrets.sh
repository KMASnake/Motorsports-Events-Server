#!/bin/sh
set -eu
PROJECT=${LOT52_PROJECT:-mse-lot52-secrets}
POSTGRES_PORT=${LOT52_POSTGRES_PORT:-55472}
PASSWORD=${LOT52_POSTGRES_PASSWORD:-lot52-secrets-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
cleanup() { docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
echo "Création de la base isolée Lot 5.2..."
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose build api >/dev/null
docker compose run --rm -T -v "$PWD/scripts:/app/scripts:ro" api node scripts/validate-lot52.mjs
echo "Tests Lot 5.2 secrets et configuration : OK"
