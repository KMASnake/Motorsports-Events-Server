#!/bin/sh
set -eu

PROJECT=${LOT43_API_PROJECT:-mse-lot43-api}
POSTGRES_PORT=${LOT43_API_POSTGRES_PORT:-55454}
API_PORT=${LOT43_API_PORT:-3551}
PASSWORD=${LOT43_API_POSTGRES_PASSWORD:-lot43-api-test}
AUTH_SECRET=${LOT43_API_AUTH_SECRET:-lot43-api-secret-with-at-least-thirty-two-characters}
PROVIDER_SESSION_ID=lot43-provider-session
PROVIDER_DUPLICATE_TITLE_ID=lot43-provider-duplicate-title
HIDDEN_SESSION_ID=lot43-hidden-event-session

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT API_HOST_PORT="$API_PORT" WEB_HOST_PORT=${LOT43_API_WEB_PORT:-3550}
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://localhost:$API_PORT"
export ADMIN_AUTH_SECRET="$AUTH_SECRET"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

token() {
  role=$1
  subject=$2
  lifetime=${3:-3600}
  docker run --rm \
    -e ADMIN_AUTH_SECRET="$AUTH_SECRET" -e ADMIN_ROLE="$role" -e ADMIN_SUBJECT="$subject" \
    -e ADMIN_TOKEN_LIFETIME_SECONDS="$lifetime" \
    -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs
}

echo "Création de la pile API Sessions isolée..."
cleanup
docker compose up --build -d api >/dev/null
for attempt in $(seq 1 60); do
  if wget -qO- "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 60 ] || { docker compose logs api; exit 1; }
  sleep 1
done

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events < tests/fixtures/lot43_events.sql

sql "insert into sessions(
  id,event_id,name,type,starts_at,status,published,origin,provider_key,external_id
) values (
  '$PROVIDER_SESSION_ID','evt-002','Session fournisseur protégée','race',
  '2026-09-01T10:00:00Z','scheduled',true,'provider','lot43-test','provider-session-1'
) , (
  '$PROVIDER_DUPLICATE_TITLE_ID','evt-002','alpha essais','practice',
  '2026-09-01T11:00:00Z','scheduled',true,'provider','lot43-test','provider-session-2'
)"
sql "insert into events(
  id,championship_id,circuit_id,name,slug,starts_at,timezone,status,published,origin
) values (
  'lot43-hidden-event','motogp','lemans','Événement public masqué','lot43-hidden-event',
  '2026-09-02T10:00:00Z','UTC','scheduled',false,'manual'
);
insert into sessions(
  id,event_id,name,type,starts_at,status,published,origin
) values (
  '$HIDDEN_SESSION_ID','lot43-hidden-event','Session parent masqué','other',
  '2026-09-02T10:00:00Z','scheduled',true,'manual'
)"
sql "create or replace function lot43_reject_session_audit() returns trigger language plpgsql as \$\$
begin
  if new.resource_type='session' and new.new_value->>'name'='lot43-audit-failure' then
    raise exception 'synthetic audit failure';
  end if;
  return new;
end \$\$;
create trigger lot43_reject_session_audit before insert on admin_audit_log
for each row execute function lot43_reject_session_audit()"

ADMIN_TOKEN=$(token admin lot43-api-test)
VIEWER_TOKEN=$(token viewer lot43-viewer-test)
EXPIRED_TOKEN=$(token admin lot43-expired-test -1)
export ADMIN_TOKEN VIEWER_TOKEN EXPIRED_TOKEN PROVIDER_SESSION_ID HIDDEN_SESSION_ID

docker run --rm --network host \
  -e API_URL="http://127.0.0.1:$API_PORT" \
  -e ADMIN_TOKEN -e VIEWER_TOKEN -e EXPIRED_TOKEN -e PROVIDER_SESSION_ID -e HIDDEN_SESSION_ID \
  -v "$PWD/scripts:/scripts:ro" node:22-alpine \
  node /scripts/validate-lot43-api.mjs

sql "drop trigger lot43_reject_session_audit on admin_audit_log;
drop function lot43_reject_session_audit();
delete from sessions where id in ('$PROVIDER_SESSION_ID','$PROVIDER_DUPLICATE_TITLE_ID')"
sql "delete from events where id='lot43-hidden-event'"

echo "Tests API Sessions Lot 4.3 : OK"
