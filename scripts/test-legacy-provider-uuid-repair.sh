#!/bin/sh
set -eu

PROJECT=${LEGACY_UUID_PROJECT:-mse-legacy-uuid-repair}
POSTGRES_PORT=${LEGACY_UUID_POSTGRES_PORT:-55490}
PASSWORD=${LEGACY_UUID_POSTGRES_PASSWORD:-legacy-uuid-repair-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
sql(){ docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"; }
assert_references_valid(){
  [ "$(sql "select count(*) from pg_constraint where contype='f' and confrelid in ('provider_instances'::regclass,'provider_championships'::regclass) and not convalidated")" = 0 ]
  [ "$(sql "select count(*) from pg_constraint where contype='f' and confrelid in ('provider_instances'::regclass,'provider_championships'::regclass) and confupdtype<>'a'")" = 0 ]
}
trap cleanup EXIT INT TERM
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

old_provider=31a3708e-15cd-06a8-fbc0-eea752ea37c7
new_provider=31a3708e-15cd-56a8-8bc0-eea752ea37c7
[ "$(sql "select count(*) from provider_instances where id='$new_provider'")" = 1 ]
[ "$(sql "select count(*) from provider_instances where id='$old_provider'")" = 0 ]
[ "$(sql "select count(*) from provider_championships pc join championships c on c.id=pc.championship_id where c.provider_key is not null and substring(pc.id::text,15,1)='5' and substring(pc.id::text,20,1) in ('8','9','a','b')")" -gt 0 ]
assert_references_valid

before=$(sql "select (select count(*) from provider_instances where adapter_key='legacy-unresolved') || ':' || (select count(*) from provider_championships)")
docker compose run --rm migrate sh /migrations/migrate.sh down 0026_legacy_provider_uuid_repair >/dev/null
[ "$(sql "select count(*) from provider_instances where id='$old_provider'")" = 1 ]
[ "$(sql "select count(*) from provider_instances where id='$new_provider'")" = 0 ]
assert_references_valid

docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from provider_instances where id='$new_provider'")" = 1 ]
[ "$(sql "select count(*) from provider_instances where id='$old_provider'")" = 0 ]
[ "$before" = "$(sql "select (select count(*) from provider_instances where adapter_key='legacy-unresolved') || ':' || (select count(*) from provider_championships)")" ]
assert_references_valid

node -e "const {z}=require('zod'); const uuid=z.string().uuid(); uuid.parse('$new_provider'); if(uuid.safeParse('$old_provider').success) process.exit(1)"
echo 'Legacy provider UUID fresh/up/down/up repair: PASS'
