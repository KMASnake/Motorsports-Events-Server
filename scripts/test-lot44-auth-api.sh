#!/bin/sh
set -eu

PROJECT=${LOT44_PROJECT:-mse-lot44-auth-api}
POSTGRES_PORT=${LOT44_POSTGRES_PORT:-55465}
API_PORT=${LOT44_API_PORT:-3561}
PASSWORD=${LOT44_POSTGRES_PASSWORD:-lot44-api-test}
ADMIN_AUTH_SECRET=${ADMIN_AUTH_SECRET:-lot44-technical-secret-with-at-least-32-chars}
ADMIN_SESSION_SECRET=${ADMIN_SESSION_SECRET:-lot44-session-secret-with-at-least-32-chars}
ORIGIN=${LOT44_WEB_ORIGIN:-http://localhost:3560}

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT API_HOST_PORT="$API_PORT" WEB_HOST_PORT=3560
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export ADMIN_AUTH_SECRET ADMIN_SESSION_SECRET
export ADMIN_WEB_ORIGIN="$ORIGIN" ADMIN_COOKIE_SECURE=false TRUST_PROXY=false

TMP_DIR=$(mktemp -d)
cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

request_code() {
  curl -sS -o "$TMP_DIR/body" -w '%{http_code}' "$@"
}

login() {
  curl -sS -c "$TMP_DIR/cookies" -o "$TMP_DIR/login.json" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
    -d "{\"username\":\"admin\",\"password\":\"$1\"}" \
    "http://127.0.0.1:$API_PORT/api/v1/auth/login"
}

echo "Démarrage de la pile isolée Lot 4.4 étape 2..."
docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose build api >/dev/null
printf '%s\n' 'correct horse battery staple' | docker compose run --rm -T api \
  node apps/api/dist/cli/admin.js create --username admin --password-stdin >/dev/null
docker compose up --no-deps -d api >/dev/null
for attempt in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && break
  [ "$attempt" -lt 40 ] || { echo "API non opérationnelle" >&2; exit 1; }
  sleep 1
done

[ "$(request_code "http://127.0.0.1:$API_PORT/api/v1/admin/events?page=1&page_size=10")" = "401" ]
[ "$(request_code -H 'Content-Type: application/json' -H 'Origin: https://evil.invalid' \
  -d '{"username":"admin","password":"correct horse battery staple"}' \
  "http://127.0.0.1:$API_PORT/api/v1/auth/login")" = "403" ]
[ "$(login 'correct horse battery staple')" = "200" ]
node -e "const v=require('$TMP_DIR/login.json');if(!v.authenticated||v.administrator.username!=='admin'||!v.idle_expires_at||!v.absolute_expires_at)process.exit(1)"
csrf=$(awk '$6=="mse_admin_csrf" {print $7}' "$TMP_DIR/cookies")
[ -n "$csrf" ]
grep -q 'mse_admin_session' "$TMP_DIR/cookies"
echo "Login, réponse publique et cookies locaux : OK"

[ "$(request_code -b "$TMP_DIR/cookies" "http://127.0.0.1:$API_PORT/api/v1/auth/session")" = "200" ]
[ "$(request_code -b "$TMP_DIR/cookies" "http://127.0.0.1:$API_PORT/api/v1/admin/events?page=1&page_size=10")" = "200" ]
[ "$(request_code -b "$TMP_DIR/cookies" -H 'Authorization: Bearer invalid' \
  "http://127.0.0.1:$API_PORT/api/v1/admin/events?page=1&page_size=10")" = "401" ]
[ "$(request_code -X POST -b "$TMP_DIR/cookies" -H "Origin: $ORIGIN" \
  "http://127.0.0.1:$API_PORT/api/v1/auth/logout")" = "403" ]
[ "$(request_code -X POST -b "$TMP_DIR/cookies" -H "Origin: $ORIGIN" -H "X-CSRF-Token: $csrf" \
  "http://127.0.0.1:$API_PORT/api/v1/auth/logout")" = "204" ]
[ "$(request_code -b "$TMP_DIR/cookies" "http://127.0.0.1:$API_PORT/api/v1/auth/session")" = "401" ]
echo "Session, priorité Authorization, CSRF et logout : OK"

for attempt in 1 2 3 4; do
  [ "$(login 'incorrect password value')" = "401" ]
done
[ "$(login 'incorrect password value')" = "429" ]
[ "$(login 'correct horse battery staple')" = "429" ]
[ "$(sql "select failed_attempts=5 and blocked_until>now() from admin_login_guard")" = "t" ]
sql "update admin_login_guard set blocked_until=now()-interval '1 second'"
[ "$(login 'correct horse battery staple')" = "200" ]
[ "$(sql "select failed_attempts=0 and window_started_at is null and blocked_until is null from admin_login_guard")" = "t" ]
echo "Anti-bruteforce et réinitialisation après succès : OK"

sql "update admin_sessions set idle_expires_at=created_at where revoked_at is null"
[ "$(request_code -b "$TMP_DIR/cookies" "http://127.0.0.1:$API_PORT/api/v1/auth/session")" = "401" ]
[ "$(login 'correct horse battery staple')" = "200" ]
sql "update admin_sessions set idle_expires_at=created_at+interval '1 millisecond',absolute_expires_at=created_at+interval '1 millisecond' where revoked_at is null"
[ "$(request_code -b "$TMP_DIR/cookies" "http://127.0.0.1:$API_PORT/api/v1/auth/session")" = "401" ]
echo "Expirations idle et absolue : OK"

technical_token=$(node scripts/generate-admin-token.mjs)
[ "$(request_code -H "Authorization: Bearer $technical_token" \
  "http://127.0.0.1:$API_PORT/api/v1/admin/events?page=1&page_size=10")" = "200" ]
[ "$(sql "select count(*)>=1 from admin_audit_log where action='auth.login_succeeded'")" = "t" ]
[ "$(sql "select count(*)>=4 from admin_audit_log where action='auth.login_failed'")" = "t" ]
[ "$(sql "select count(*)>=1 from admin_audit_log where action='auth.login_blocked'")" = "t" ]
[ "$(sql "select count(*)>=1 from admin_audit_log where action='auth.logout'")" = "t" ]
[ "$(sql "select count(*) from admin_audit_log where resource_type='authentication' and (coalesce(old_value::text,'')||coalesce(new_value::text,'')) ~* 'password|cookie|token|secret'")" = "0" ]
echo "HMAC technique et audit sans secret : OK"

docker compose logs --no-color api | grep -F 'correct horse battery staple' >/dev/null && {
  echo "Échec : mot de passe présent dans les logs" >&2
  exit 1
}
echo "Tests Lot 4.4 étape 2 : OK"
