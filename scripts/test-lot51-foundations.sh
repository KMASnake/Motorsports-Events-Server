#!/bin/sh
set -eu

PROJECT=${LOT51_PROJECT:-mse-lot51-foundations}
POSTGRES_PORT=${LOT51_POSTGRES_PORT:-55471}
PASSWORD=${LOT51_POSTGRES_PASSWORD:-lot51-foundations-test}

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

rollback() {
  docker compose run --rm migrate sh /migrations/migrate.sh down "$1"
}

echo "Création de la base isolée Lot 5.1..."
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

[ "$(sql "select count(*) from schema_migrations where version in ('0007_provider_instances','0008_provider_championship_sources')")" = "2" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('provider_instances','provider_secrets','provider_quota_policies','provider_quota_state','provider_championships','provider_championship_source_configs')")" = "6" ]
[ "$(sql "select count(*) from provider_secrets")" = "0" ]
[ "$(sql "select count(*) from provider_quota_policies")" = "0" ]
[ "$(sql "select count(*) from provider_quota_state")" = "0" ]
[ "$(sql "select count(*) from provider_championships where sync_state <> 'inactive' or is_primary")" = "0" ]
[ "$(sql "select count(*) from provider_championship_source_configs")" = "0" ]
echo "Migrations M1/M2 et reprise historique sûre : OK"

before=$(sql "select count(*) || ':' || coalesce(md5(string_agg(id || ':' || name, ',' order by id)), '') from championships")
docker compose run --rm migrate >/dev/null
after=$(sql "select count(*) || ':' || coalesce(md5(string_agg(id || ':' || name, ',' order by id)), '') from championships")
[ "$before" = "$after" ]
[ "$(sql "select count(*) from schema_migrations where version in ('0007_provider_instances','0008_provider_championship_sources')")" = "2" ]
echo "Seconde montée idempotente et données Lot 4.4 préservées : OK"

championship_a=$(sql "select id from championships order by id limit 1")
championship_b=$(sql "select id from championships order by id offset 1 limit 1")
[ -n "$championship_a" ] && [ -n "$championship_b" ]

sql "insert into provider_instances(id,adapter_key,name,enabled,state)
     values ('10000000-0000-4000-8000-000000000001','fake-page','Fake Page',true,'active'),
            ('10000000-0000-4000-8000-000000000002','fake-third','Fake Third',true,'active');
     insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary)
     values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','$championship_a','source-a','configured','active',true),
            ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','$championship_b','source-b','configured','inactive',false);
     insert into provider_championship_source_configs(provider_championship_id,schema_version,config)
     values ('20000000-0000-4000-8000-000000000001',1,'{\"strategy\":\"page\",\"external_id\":\"source-a\"}'),
            ('20000000-0000-4000-8000-000000000002',1,'{\"strategy\":\"compound\",\"external_id\":\"source-b\"}')"
[ "$(sql "select count(distinct config) from provider_championship_source_configs where provider_championship_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002')")" = "2" ]
echo "Deux configurations distinctes pour une même instance fournisseur : OK"

if sql "insert into provider_championships(id,provider_instance_id,championship_id,discovery_state,sync_state,is_primary)
        values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','$championship_a','configured','active',true)" >/dev/null 2>&1; then
  echo "Échec : deux fournisseurs principaux actifs ont été acceptés" >&2
  exit 1
fi
echo "Unicité concurrente du fournisseur principal actif : OK"

sql "delete from provider_championship_source_configs where provider_championship_id::text like '20000000-%';
     delete from provider_championships where id::text like '20000000-%';
     delete from provider_instances where id::text like '10000000-%'"
rollback 0008_provider_championship_sources >/dev/null
rollback 0007_provider_instances >/dev/null
[ "$(sql "select count(*) from schema_migrations where version in ('0007_provider_instances','0008_provider_championship_sources')")" = "0" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('provider_instances','provider_secrets','provider_quota_policies','provider_quota_state','provider_championships','provider_championship_source_configs')")" = "0" ]
[ "$(sql "select count(*) || ':' || coalesce(md5(string_agg(id || ':' || name, ',' order by id)), '') from championships")" = "$before" ]
docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version in ('0007_provider_instances','0008_provider_championship_sources')")" = "2" ]
echo "DOWN M2/M1 réversible puis réapplication : OK"
echo "Tests Lot 5.1 fondations : OK"
