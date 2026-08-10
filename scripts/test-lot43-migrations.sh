#!/bin/sh
set -eu

PROJECT=${LOT43_PROJECT:-mse-lot43-migrations}
POSTGRES_PORT=${LOT43_POSTGRES_PORT:-55453}
API_PORT=${LOT43_API_PORT:-3541}
PASSWORD=${LOT43_POSTGRES_PASSWORD:-lot43-migration-test}

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT API_HOST_PORT="$API_PORT" WEB_HOST_PORT=${LOT43_WEB_PORT:-3540}
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
export VITE_API_URL="http://localhost:$API_PORT"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

apply_file() {
  docker compose run --rm migrate \
    psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -1 \
    -f "/migrations/$1"
}

rollback_0004() {
  docker compose run --rm migrate \
    sh /migrations/migrate.sh down 0004_sessions
}

expect_sql_failure() {
  description=$1
  statement=$2
  if sql "$statement" >/dev/null 2>&1; then
    echo "Échec : $description a été accepté" >&2
    exit 1
  fi
  echo "$description : rejeté comme attendu"
}

expect_rollback_failure() {
  description=$1
  if rollback_0004 >/dev/null 2>&1; then
    echo "Échec : rollback accepté malgré $description" >&2
    exit 1
  fi
  echo "Rollback refusé ($description) : OK"
}

lot42_fingerprint() {
  sql "select md5(jsonb_build_object(
    'events', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from events t),
    'event_corrections', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from event_corrections t),
    'admin_audit_log', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from admin_audit_log t)
  )::text)"
}

database_fingerprint() {
  sql "select md5(jsonb_build_object(
    'lot42', '$1',
    'schema_migrations', (select jsonb_agg(to_jsonb(t) order by version) from schema_migrations t),
    'session_types', (select jsonb_agg(to_jsonb(t) order by sort_order, key) from session_types t),
    'sessions', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from sessions t),
    'session_corrections', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb) from session_corrections t)
  )::text)"
}

echo "Création de la base PostgreSQL Lot 4.2 isolée..."
cleanup
docker compose up -d --wait postgres >/dev/null

sql "create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
)"
apply_file 0001_event_corrections.up.sql >/dev/null
apply_file 0002_utc_storage.up.sql >/dev/null
apply_file 0003_admin_audit_and_provider_identity.up.sql >/dev/null

sql "insert into event_corrections(
  id,event_id,provider_key,external_id,field_name,
  provider_value,override_value,status,created_by
) values (
  'lot43-baseline-correction','evt-002','baseline','evt-002','name',
  '\"Grand Prix source\"','\"Grand Prix local\"','active','lot43-test'
)"
sql "insert into admin_audit_log(
  actor,action,resource_type,resource_id,request_id,old_value,new_value
) values (
  'lot43-test','baseline.fixture','event','evt-002','lot43-baseline-request',
  '{\"name\":\"Grand Prix source\"}','{\"name\":\"Grand Prix local\"}'
)"

versions=$(sql "select string_agg(version, ',' order by version) from schema_migrations")
[ "$versions" = "0001_event_corrections,0002_utc_storage,0003_admin_audit_and_provider_identity" ]
before=$(lot42_fingerprint)
echo "Empreinte Lot 4.2 avant migration : $before"

docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0004_sessions'")" = "1" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('session_types','sessions','session_corrections')")" = "3" ]
[ "$(sql "select string_agg(key || ':' || label || ':' || sort_order || ':' || active, ',' order by sort_order) from session_types")" = "practice:Essais:1:true,qualifying:Qualifications:2:true,sprint:Sprint:3:true,warmup:Warm-up:4:true,race:Course:5:true,other:Autre:6:true" ]
[ "$(sql "select count(*) from session_types")" = "6" ]
after_up=$(lot42_fingerprint)
[ "$before" = "$after_up" ]
echo "Migration et intégrité Lot 4.2 : OK ($after_up)"

types_before=$(sql "select md5(jsonb_agg(to_jsonb(t) order by sort_order, key)::text) from session_types t")
apply_file 0004_sessions.up.sql >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0004_sessions'")" = "1" ]
[ "$types_before" = "$(sql "select md5(jsonb_agg(to_jsonb(t) order by sort_order, key)::text) from session_types t")" ]
echo "Seconde montée idempotente : OK"

docker compose build api >/dev/null
api_before=$(database_fingerprint "$before")
sql "alter role mse set default_transaction_read_only = on"
docker compose up --no-deps -d api >/dev/null
for attempt in $(seq 1 30); do
  if wget -qO- "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
    break
  fi
  [ "$attempt" -lt 30 ] || { echo "API non opérationnelle" >&2; exit 1; }
  sleep 1
done
docker compose restart api >/dev/null
docker compose restart api >/dev/null
for attempt in $(seq 1 30); do
  if wget -qO- "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
    break
  fi
  [ "$attempt" -lt 30 ] || { echo "API non opérationnelle après redémarrage" >&2; exit 1; }
  sleep 1
done
api_after=$(database_fingerprint "$before")
[ "$api_before" = "$api_after" ]
docker compose exec -T \
  -e PGOPTIONS='-c default_transaction_read_only=off' \
  postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events \
  -c 'alter role mse reset default_transaction_read_only' >/dev/null
echo "Deux redémarrages API en lecture seule, sans écriture : OK"

sql "insert into events(
  id,championship_id,name,slug,starts_at,ends_at,timezone,status,published,origin
) values (
  'lot43-event','f1','Événement Sessions Lot 4.3','lot43-sessions-fixture',
  '2026-10-24T20:00:00Z','2026-10-26T00:00:00Z','UTC','scheduled',true,'manual'
)"

sql "insert into sessions(
  id,event_id,name,type,starts_at,ends_at,status,published,origin
) values
  ('lot43-normal','lot43-event','Essais UTC','practice','2026-06-12T14:00:00+02:00','2026-06-12T15:00:00+02:00','scheduled',true,'manual'),
  ('lot43-midnight','lot43-event','Course de nuit','race','2026-06-13T23:30:00Z','2026-06-14T01:00:00Z','scheduled',true,'manual'),
  ('lot43-dst','lot43-event','Session DST','qualifying','2026-10-25T02:30:00+02:00','2026-10-25T02:30:00+01:00','scheduled',true,'manual'),
  ('lot43-overlap-a','lot43-event','Chevauchement A','practice','2026-06-15T10:00:00Z','2026-06-15T11:00:00Z','scheduled',true,'manual'),
  ('lot43-overlap-b','lot43-event','Chevauchement B','warmup','2026-06-15T10:30:00Z','2026-06-15T11:30:00Z','scheduled',true,'manual'),
  ('lot43-open','lot43-event','Sans fin','other','2026-06-16T09:00:00Z',null,'scheduled',true,'manual'),
  ('lot43-provider','lot43-event','Fournisseur','race','2026-06-17T09:00:00Z','2026-06-17T10:00:00Z','scheduled',true,'provider')"
sql "update sessions set provider_key='test-provider', external_id='provider-session-1' where id='lot43-provider'"
[ "$(sql "select to_char(starts_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') from sessions where id='lot43-normal'")" = "2026-06-12 12:00:00" ]
[ "$(sql "select extract(epoch from ends_at-starts_at)::int from sessions where id='lot43-dst'")" = "3600" ]
[ "$(sql "select count(*) from sessions where id in ('lot43-overlap-a','lot43-overlap-b')")" = "2" ]
[ "$(sql "select count(*) from sessions where id='lot43-open' and ends_at is null")" = "1" ]
echo "UTC, minuit, DST et chevauchement : OK"

expect_sql_failure "Fin antérieure au début" "insert into sessions(id,event_id,name,type,starts_at,ends_at,status,origin) values ('lot43-invalid-time','lot43-event','Invalide','practice','2026-06-12T15:00:00Z','2026-06-12T14:00:00Z','scheduled','manual')"
expect_sql_failure "Type inconnu" "insert into sessions(id,event_id,name,type,starts_at,status,origin) values ('lot43-invalid-type','lot43-event','Invalide','unknown','2026-06-12T15:00:00Z','scheduled','manual')"
expect_sql_failure "Événement inexistant" "insert into sessions(id,event_id,name,type,starts_at,status,origin) values ('lot43-invalid-event','missing-event','Invalide','practice','2026-06-12T15:00:00Z','scheduled','manual')"
expect_sql_failure "Identité fournisseur dupliquée" "insert into sessions(id,event_id,name,type,starts_at,status,origin,provider_key,external_id) values ('lot43-invalid-provider','lot43-event','Doublon','race','2026-06-17T11:00:00Z','scheduled','provider','test-provider','provider-session-1')"

sql "insert into session_corrections(
  id,session_id,provider_key,external_id,field_name,
  provider_value,override_value,status,created_by
) values (
  'lot43-session-correction','lot43-normal','test-provider','normal-1','name',
  '\"Essais source\"','\"Essais UTC\"','active','lot43-test'
)"
expect_rollback_failure "présence de Sessions"

sql "delete from events where id='lot43-event'"
[ "$(sql "select count(*) from sessions where id like 'lot43-%'")" = "0" ]
[ "$(sql "select count(*) from session_corrections where id='lot43-session-correction'")" = "0" ]
echo "Cascade Event vers Sessions et corrections : OK"

sql "insert into session_types(key,label,sort_order,active) values ('custom-test','Personnalisé',99,true)"
expect_rollback_failure "type personnalisé"
sql "delete from session_types where key='custom-test'"

sql "update session_types set label='Autre modifié' where key='other'"
expect_rollback_failure "type initial modifié"
sql "update session_types set label='Autre' where key='other'"

sql "insert into events(
  id,championship_id,name,slug,starts_at,timezone,status,published,origin
) values (
  'lot43-orphan-event','f1','Fixture garde correction','lot43-orphan-fixture',
  '2026-06-16T10:00:00Z','UTC','scheduled',true,'manual'
)"
sql "insert into sessions(id,event_id,name,type,starts_at,status,origin) values ('lot43-orphan-session','lot43-orphan-event','Fixture','other','2026-06-16T10:00:00Z','scheduled','manual')"
sql "insert into session_corrections(id,session_id,provider_key,field_name,status) values ('lot43-orphan-correction','lot43-orphan-session','test-provider','name','active')"
sql "set session_replication_role=replica; delete from sessions where id='lot43-orphan-session'; set session_replication_role=origin"
expect_rollback_failure "correction de Session orpheline"
sql "delete from session_corrections where id='lot43-orphan-correction'; delete from events where id='lot43-orphan-event'"

[ "$before" = "$(lot42_fingerprint)" ]
rollback_0004 >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0004_sessions'")" = "0" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('session_types','sessions','session_corrections')")" = "0" ]
[ "$before" = "$(lot42_fingerprint)" ]
echo "Rollback non destructif et empreinte Lot 4.2 inchangée : OK"

docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0004_sessions'")" = "1" ]
[ "$(sql "select count(*) from session_types")" = "6" ]
[ "$before" = "$(lot42_fingerprint)" ]
echo "Réapplication 0004_sessions : OK"
echo "Tests des migrations Lot 4.3 : OK"
