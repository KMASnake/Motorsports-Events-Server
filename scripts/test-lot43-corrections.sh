#!/bin/sh
set -eu

PROJECT=${LOT43_CORRECTIONS_PROJECT:-mse-lot43-corrections}
POSTGRES_PORT=${LOT43_CORRECTIONS_POSTGRES_PORT:-55455}
API_PORT=${LOT43_CORRECTIONS_API_PORT:-3561}
PASSWORD=${LOT43_CORRECTIONS_POSTGRES_PASSWORD:-lot43-corrections-test}
AUTH_SECRET=${LOT43_CORRECTIONS_AUTH_SECRET:-lot43-corrections-secret-at-least-thirty-two-characters}
PROVIDER_SESSION_ID=lot43-corrections-session

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT API_HOST_PORT="$API_PORT" WEB_HOST_PORT=${LOT43_CORRECTIONS_WEB_PORT:-3560}
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://localhost:$API_PORT"
export ADMIN_AUTH_SECRET="$AUTH_SECRET"

cleanup() { docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
sql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"; }
token() {
  docker run --rm -e ADMIN_AUTH_SECRET="$AUTH_SECRET" -e ADMIN_ROLE="$1" -e ADMIN_SUBJECT="$2" \
    -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs
}

echo "Création de la pile Corrections Sessions isolée..."
cleanup
docker compose up --build -d api >/dev/null
for attempt in $(seq 1 60); do
  if wget -qO- "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 60 ] || { docker compose logs api; exit 1; }
  sleep 1
done

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events < tests/fixtures/lot43_events.sql

sql "insert into sessions(id,event_id,name,type,starts_at,ends_at,status,published,description,origin,provider_key,external_id)
values('$PROVIDER_SESSION_ID','evt-002','Provider initial','other','2026-09-01T10:00:00Z','2026-09-01T11:00:00Z','scheduled',true,null,'provider','lot43-corrections','session-1')"
sql "create or replace function lot43_reject_correction_audit() returns trigger language plpgsql as \$\$
begin
  if new.resource_type='session-correction' and new.new_value::text like '%lot43-correction-audit-failure%' then
    raise exception 'synthetic correction audit failure';
  end if;
  return new;
end \$\$;
create trigger lot43_reject_correction_audit before insert on admin_audit_log
for each row execute function lot43_reject_correction_audit()"

ADMIN_TOKEN=$(token admin lot43-corrections-test)
VIEWER_TOKEN=$(token viewer lot43-corrections-viewer)
export ADMIN_TOKEN VIEWER_TOKEN PROVIDER_SESSION_ID

docker run --rm --network host -e API_URL="http://127.0.0.1:$API_PORT" \
  -e ADMIN_TOKEN -e VIEWER_TOKEN -e PROVIDER_SESSION_ID \
  -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/validate-lot43-corrections.mjs

[ "$(sql "select count(*) from sessions where id='$PROVIDER_SESSION_ID'")" = "1" ]
[ "$(sql "select count(*) from session_corrections where session_id='$PROVIDER_SESSION_ID'")" = "0" ]
sql "drop trigger lot43_reject_correction_audit on admin_audit_log;
drop function lot43_reject_correction_audit();
delete from sessions where id='$PROVIDER_SESSION_ID'"

echo "Tests Corrections Sessions Lot 4.3 : OK"
