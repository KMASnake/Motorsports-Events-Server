#!/bin/sh
set -eu

PROJECT=${PRE55_VISUAL_PROJECT:-mse-pre55-security-visual}
POSTGRES_PORT=${PRE55_VISUAL_POSTGRES_PORT:-55491}
API_PORT=${PRE55_VISUAL_API_PORT:-3801}
WEB_PORT=${PRE55_VISUAL_WEB_PORT:-3800}
PASSWORD=${PRE55_VISUAL_POSTGRES_PASSWORD:-pre55-visual-test}
AUTH_SECRET=${PRE55_VISUAL_AUTH_SECRET:-pre55-visual-hmac-secret-at-least-thirty-two-characters}
SESSION_SECRET=${PRE55_VISUAL_SESSION_SECRET:-pre55-visual-session-secret-at-least-thirty-two-characters}
TEST_WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/mse-pre55-visual.XXXXXX")

export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT
export API_HOST_PORT="$API_PORT" WEB_HOST_PORT="$WEB_PORT" POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://127.0.0.1:$API_PORT"
export ADMIN_AUTH_SECRET="$AUTH_SECRET" ADMIN_SESSION_SECRET="$SESSION_SECRET"
export ADMIN_WEB_ORIGIN="http://127.0.0.1:$WEB_PORT" ADMIN_COOKIE_SECURE=false TRUST_PROXY=false
export API_URL="http://127.0.0.1:$API_PORT" WEB_URL="http://127.0.0.1:$WEB_PORT"

stack_cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
cleanup(){
  stack_cleanup
  docker run --rm -v "$TEST_WORKDIR:/work" node:22-alpine find /work -mindepth 1 -delete >/dev/null 2>&1 || true
  rmdir "$TEST_WORKDIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

stack_cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose build api web >/dev/null
printf '%s\n' 'correct horse battery staple' | docker compose run --rm -T api \
  node apps/api/dist/cli/admin.js create --username admin --password-stdin >/dev/null
docker compose up --no-deps -d api web >/dev/null
for attempt in $(seq 1 60); do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1 && curl -fsS "$WEB_URL" >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 60 ] || { docker compose logs api web; exit 1; }
  sleep 1
done

docker run --rm -v "$PWD:/source:ro" -v "$TEST_WORKDIR:/work" -w /work node:22-alpine \
  sh -lc 'tar -C /source --exclude=.git --exclude=node_modules --exclude=test-results -cf - . | tar -C /work -xf - && npm ci >/dev/null'
docker run --rm --network host -e API_URL -e WEB_URL -v "$TEST_WORKDIR:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test tests/ui/security-csp.spec.ts --project=chromium
echo "Test visuel login/tableau de bord/championnats/fournisseurs sous CSP : OK"
