#!/bin/sh
set -eu

PROJECT=${LOT43_UI_PROJECT:-mse-lot43-ui}
POSTGRES_PORT=${LOT43_UI_POSTGRES_PORT:-55457}
API_PORT=${LOT43_UI_API_PORT:-3581}
WEB_PORT=${LOT43_UI_WEB_PORT:-3580}
PASSWORD=${LOT43_UI_POSTGRES_PASSWORD:-lot43-ui-test}
AUTH_SECRET=${LOT43_UI_AUTH_SECRET:-lot43-ui-secret-at-least-thirty-two-characters}

export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT
export API_HOST_PORT="$API_PORT" WEB_HOST_PORT="$WEB_PORT" POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://localhost:$API_PORT" ADMIN_AUTH_SECRET="$AUTH_SECRET"
export API_URL="http://127.0.0.1:$API_PORT" WEB_URL="http://127.0.0.1:$WEB_PORT"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo "Création de la pile UI Sessions isolée..."
cleanup
docker compose up --build -d
for attempt in $(seq 1 60); do
  if wget -qO- "$API_URL/health" >/dev/null 2>&1 && wget -qO- "$WEB_URL" >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 60 ] || { docker compose logs api web; exit 1; }
  sleep 1
done

DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events" npm run data:generate -- --seed=lot43-ui
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events < tests/fixtures/lot43_ui.sql
ADMIN_TOKEN=$(docker run --rm -e ADMIN_AUTH_SECRET="$AUTH_SECRET" -e ADMIN_ROLE=admin -e ADMIN_SUBJECT=lot43-ui-test -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)
export ADMIN_TOKEN

docker run --rm --network host --user "$(id -u):$(id -g)" \
  -e API_URL -e WEB_URL -e ADMIN_TOKEN -e HOME=/tmp \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test tests/ui/events.spec.ts tests/ui/sessions.spec.ts --project=chromium
echo "Tests Chromium Sessions Lot 4.3 : OK"
