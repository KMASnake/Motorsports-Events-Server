#!/bin/sh
set -eu

PROJECT="${PUBLIC_SECURITY_PROJECT:-mse-public-security}"
DB_PORT="${PUBLIC_SECURITY_POSTGRES_PORT:-55490}"
API_PORT="${PUBLIC_SECURITY_API_PORT:-3791}"
PASSWORD="${PUBLIC_SECURITY_PASSWORD:-public-security-password}"
AUTH_SECRET="public-security-admin-auth-secret-at-least-32-characters"
SESSION_SECRET="public-security-session-secret-at-least-32-characters"
ADMIN_TOKEN="$(docker run --rm -i --network none node:22-alpine node --input-type=module - <<'NODE'
import { createHmac } from 'node:crypto';
const secret='public-security-admin-auth-secret-at-least-32-characters';
const payload=Buffer.from(JSON.stringify({sub:'security-recipe',role:'admin',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
console.log(`${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`);
NODE
)"
ID="90000000-0000-4000-8000-000000000001"

cleanup() { docker compose --project-name "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

export POSTGRES_PORT="$DB_PORT" API_HOST_PORT="$API_PORT" POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export ADMIN_AUTH_SECRET="$AUTH_SECRET" ADMIN_SESSION_SECRET="$SESSION_SECRET"
docker compose --project-name "$PROJECT" up -d postgres
docker compose --project-name "$PROJECT" run --rm migrate

docker compose --project-name "$PROJECT" exec -T postgres psql -U mse -d motorsports_events <<SQL
insert into championships(id,slug,name,season,active,sync_enabled,provider_key,external_id)
values('$ID','security-disabled','Security Disabled',2026,false,true,'INTERNAL_PROVIDER','INTERNAL_EXTERNAL');
insert into events(id,championship_id,name,slug,starts_at,status,published)
values('security-disabled-event','$ID','Hidden Event','security-hidden-event',now(),'scheduled',true);
insert into sessions(id,event_id,name,type,starts_at,status,published)
values('security-disabled-session','security-disabled-event','Hidden Session','race',now(),'scheduled',true);
insert into provider_instances(id,adapter_key,name,enabled,state)
values('90000000-0000-4000-8000-000000000002','fixture','Security Provider',false,'draft');
insert into provider_championships(id,provider_instance_id,championship_id)
values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','$ID');
insert into sync_streams(id,provider_championship_id,phase,cursor_version)
values('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000003','current',1);
SQL

docker compose --project-name "$PROJECT" build api >/dev/null
docker compose --project-name "$PROJECT" up -d api
attempt=0
until curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 40 ] || { docker compose --project-name "$PROJECT" logs api; exit 1; }; sleep 1
done

PUBLIC="$(curl -fsS "http://127.0.0.1:$API_PORT/api/v1/championships")"
DETAIL_STATUS="$(curl -sS -o /tmp/mse-public-security-detail.json -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/v1/championships/$ID")"
EVENTS="$(curl -fsS "http://127.0.0.1:$API_PORT/api/v1/events")"
ADMIN="$(curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:$API_PORT/api/v1/admin/championships")"
export PUBLIC DETAIL_STATUS EVENTS ADMIN ID
python3 - <<'PY'
import json,os
public=json.loads(os.environ['PUBLIC']); events=json.loads(os.environ['EVENTS']); admin=json.loads(os.environ['ADMIN']); target=os.environ['ID']
assert all(row['id'] != target for row in public)
assert os.environ['DETAIL_STATUS'] == '404'
assert all(row['championship_id'] != target for row in events)
row=next(row for row in admin if row['id']==target)
assert row['active'] is False and row['provider_key']=='INTERNAL_PROVIDER'
for item in public:
  assert not ({'sync_enabled','provider_key','external_id'} & item.keys())
print('Championnat désactivé caché publiquement et visible en administration : OK')
PY

docker compose --project-name "$PROJECT" exec -T postgres psql -U mse -d motorsports_events <<'SQL'
create or replace function reject_security_audit() returns trigger language plpgsql as $$
begin raise exception 'security audit failure probe'; end $$;
create trigger reject_security_audit before insert on admin_audit_log
for each row execute function reject_security_audit();
SQL
PATCH_STATUS="$(curl -sS -o /tmp/mse-public-security-patch.json -w '%{http_code}' -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"active":true}' "http://127.0.0.1:$API_PORT/api/v1/championships/$ID")"
[ "$PATCH_STATUS" = "500" ] || { echo "Échec d'audit attendu, statut reçu: $PATCH_STATUS" >&2; exit 1; }
ACTIVE="$(docker compose --project-name "$PROJECT" exec -T postgres psql -U mse -d motorsports_events -Atc "select active from championships where id='$ID'")"
[ "$ACTIVE" = "f" ] || { echo 'Mutation conservée malgré l’échec d’audit' >&2; exit 1; }
docker compose --project-name "$PROJECT" exec -T postgres psql -U mse -d motorsports_events <<'SQL'
drop trigger reject_security_audit on admin_audit_log;
drop function reject_security_audit();
SQL
echo "Rollback métier lors d’un échec d’audit : OK"

COUNTS="$(docker compose --project-name "$PROJECT" exec -T postgres psql -U mse -d motorsports_events -Atc "select (select count(*) from events where championship_id='$ID')||','||(select count(*) from sessions where event_id='security-disabled-event')||','||(select count(*) from provider_championships where championship_id='$ID')||','||(select count(*) from sync_streams where provider_championship_id='90000000-0000-4000-8000-000000000003')")"
[ "$COUNTS" = "1,1,1,1" ] || { echo "Données supprimées: $COUNTS" >&2; exit 1; }
echo "Événements, sessions, mappings et flux conservés : OK"
