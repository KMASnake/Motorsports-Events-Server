#!/bin/sh
set -eu
export COMPOSE_PROJECT_NAME=${OCBT_GRAPH_PROJECT:-mse-ocbt-graph-test}
export POSTGRES_PORT=${OCBT_GRAPH_PORT:-55498}
export POSTGRES_PASSWORD=${OCBT_GRAPH_PASSWORD:-ocbt-graph-local-test}
export DATABASE_URL="postgresql://mse:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
node scripts/validate-ocblacktop-meeting-publication.mjs
echo 'PROVIDER_CALLS=0'
echo 'PROVIDER_CREDITS=0'
