#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-f5-reconciliation-${RANDOM}-$$"
export POSTGRES_PORT=$((59000 + RANDOM % 500)) POSTGRES_PASSWORD='f5-reconciliation-local-test'
compose=(docker compose -p "${PROJECT}" -f "${ROOT}/docker-compose.yml")
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" up -d postgres >/dev/null
ready_checks=0
for _ in $(seq 1 60);do
  if "${compose[@]}" exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null 2>&1 \
    && "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc 'select 1' 2>/dev/null | grep -qx 1;then
    ready_checks=$((ready_checks+1))
    [[ "${ready_checks}" -ge 3 ]]&&break
  else
    ready_checks=0
  fi
  sleep 1
done
if [[ "${ready_checks}" -lt 3 ]];then
  echo 'F5-6 PostgreSQL did not reach stable readiness.' >&2
  exit 1
fi
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -c 'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())' >/dev/null
for migration in "${ROOT}"/infra/postgres/migrations/*.up.sql;do
  version="$(basename "${migration}" .up.sql)"
  [[ "${version}" == 0037_f5_multi_provider_reconciliation ]]&&break
  "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d motorsports_events <"${migration}" >/dev/null
done
"${compose[@]}" exec -T postgres createdb -U mse -T motorsports_events f56_empty
"${compose[@]}" exec -T postgres createdb -U mse -T motorsports_events f56_unmappable
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d f56_unmappable <<'SQL' >/dev/null
insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin)
values('f56-unmappable','f1','Unmappable','f56-unmappable','other','other',now(),'UTC','scheduled',true,'provider');
insert into event_corrections(id,event_id,provider_key,field_name,override_value,status)
values('legacy-unmappable','f56-unmappable','legacy','name','"No UUID"','active');
SQL
if "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d f56_unmappable <"${ROOT}/infra/postgres/migrations/0037_f5_multi_provider_reconciliation.up.sql" >/dev/null 2>&1;then echo 'F5-6 unmappable legacy import accepted' >&2;exit 1;fi
[[ "$("${compose[@]}" exec -T postgres psql -U mse -d f56_unmappable -Atc "select count(*) from event_corrections where id='legacy-unmappable'")" == 1 ]]
[[ "$("${compose[@]}" exec -T postgres psql -U mse -d f56_unmappable -Atc "select count(*) from schema_migrations where version='0037_f5_multi_provider_reconciliation'")" == 0 ]]
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d f56_empty <"${ROOT}/infra/postgres/migrations/0037_f5_multi_provider_reconciliation.up.sql" >/dev/null
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d f56_empty <"${ROOT}/infra/postgres/migrations/0037_f5_multi_provider_reconciliation.down.sql" >/dev/null
[[ "$("${compose[@]}" exec -T postgres psql -U mse -d f56_empty -Atc "select version from schema_migrations order by version desc limit 1")" == 0036_f5_meeting_event_canonical_resolution ]]
[[ "$("${compose[@]}" exec -T postgres psql -U mse -d f56_empty -Atc "select to_regclass('public.event_corrections') is not null and to_regclass('public.provider_source_corrections') is not null")" == t ]]
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d f56_empty <"${ROOT}/infra/postgres/migrations/0037_f5_multi_provider_reconciliation.up.sql" >/dev/null
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values('57100000-0000-4000-8000-000000000020','f1','f56-legacy-2026','F5-6 Legacy 2026',2026,2026);
insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values('57100000-0000-4000-8000-000000000021','f1','57100000-0000-4000-8000-000000000020','F5-6 Legacy Meeting',2026,'UTC');
begin;
insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin,provider_key,external_id,normalized_uuid)
values('f56-legacy-active','f1','Admin A','f56-legacy-active','other','other',now(),'UTC','scheduled',true,'provider','legacy','active','57100000-0000-4000-8000-000000000001'),
      ('f56-legacy-conflict','f1','Legacy Conflict','f56-legacy-conflict','other','other',now(),'UTC','scheduled',true,'provider','legacy','conflict','57100000-0000-4000-8000-000000000002'),
      ('f56-legacy-history','f1','Legacy History','f56-legacy-history','other','other',now(),'UTC','scheduled',true,'provider','legacy','history','57100000-0000-4000-8000-000000000003');
insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,ends_at,timezone,status,published,origin,provider_key,external_id,normalized_uuid,session_title)
values('f56-legacy-matrix','f1','Admin Matrix','f56-legacy-matrix','practice','practice','2026-12-10T10:00:00Z','2026-12-10T11:00:00Z','UTC','scheduled',true,'provider','legacy','matrix','57100000-0000-4000-8000-000000000004','Admin FP1');
insert into meeting_events(meeting_id,event_id,position) values
 ('57100000-0000-4000-8000-000000000021','f56-legacy-active',0),
 ('57100000-0000-4000-8000-000000000021','f56-legacy-conflict',1),
 ('57100000-0000-4000-8000-000000000021','f56-legacy-history',2),
 ('57100000-0000-4000-8000-000000000021','f56-legacy-matrix',3);
commit;
insert into event_corrections(id,event_id,provider_key,external_id,field_name,provider_value,override_value,status,created_by,created_at,updated_at)
values('legacy-active','f56-legacy-active','legacy','active','name','"Provider A"','"Admin A"','active','legacy-admin','2026-01-01','2026-01-02'),
      ('legacy-conflict','f56-legacy-conflict','legacy','conflict','name','"Provider B"','"Admin B"','conflict','legacy-admin','2026-01-03','2026-01-04'),
      ('legacy-resolved','f56-legacy-history','legacy','resolved','name','"Provider C"','"Admin C"','resolved','legacy-admin','2026-01-05','2026-01-06'),
      ('legacy-ignored','f56-legacy-history','legacy','ignored','status','"scheduled"','"cancelled"','ignored','legacy-admin','2026-01-07','2026-01-08'),
      ('legacy-matrix-name','f56-legacy-matrix','legacy','matrix','name','"Provider Name"','"Admin Matrix"','active','legacy-admin','2026-01-09','2026-01-10'),
      ('legacy-matrix-starts','f56-legacy-matrix','legacy','matrix','starts_at','"2026-12-10T12:00:00.000Z"','"2026-12-10T10:00:00.000Z"','active','legacy-admin','2026-01-09','2026-01-10'),
      ('legacy-matrix-ends','f56-legacy-matrix','legacy','matrix','ends_at','"2026-12-10T13:00:00.000Z"','"2026-12-10T11:00:00.000Z"','active','legacy-admin','2026-01-09','2026-01-10'),
      ('legacy-matrix-status','f56-legacy-matrix','legacy','matrix','status','"cancelled"','"scheduled"','active','legacy-admin','2026-01-09','2026-01-10'),
      ('legacy-matrix-session','f56-legacy-matrix','legacy','matrix','session_title','"Provider FP1"','"Admin FP1"','active','legacy-admin','2026-01-09','2026-01-10');
insert into provider_instances(id,adapter_key,name,enabled,state) values('57100000-0000-4000-8000-000000000010','f56-legacy-source','F5-6 legacy source',false,'paused');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state) values('57100000-0000-4000-8000-000000000011','57100000-0000-4000-8000-000000000010','f1','legacy-f1','inactive');
insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at)
values('57100000-0000-4000-8000-000000000012','57100000-0000-4000-8000-000000000010','57100000-0000-4000-8000-000000000011','meeting','legacy-source','{"name":"Raw"}','legacy-source-hash',now(),now(),now());
insert into provider_source_corrections(id,source_entity_id,field_path,override_value,source_value_at_creation,reason,origin,actor_id)
values('57100000-0000-4000-8000-000000000013','57100000-0000-4000-8000-000000000012','name','"Corrected"','"Raw"','legacy proof','administrator','maintainer');
SQL
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -1 -U mse -d motorsports_events <"${ROOT}/infra/postgres/migrations/0037_f5_multi_provider_reconciliation.up.sql" >/dev/null
sql(){ "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc "$1"; }
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0037_f5_multi_provider_reconciliation ]]
[[ "$(sql "select count(*) from event_corrections where id in('legacy-active','legacy-conflict','legacy-resolved','legacy-ignored','legacy-matrix-name','legacy-matrix-starts','legacy-matrix-ends','legacy-matrix-status','legacy-matrix-session')")" == 9 ]]
[[ "$(sql "select count(*) from canonical_field_overrides where legacy_event_correction_id in('legacy-active','legacy-conflict','legacy-matrix-name','legacy-matrix-starts','legacy-matrix-ends','legacy-matrix-status','legacy-matrix-session') and status='active'")" == 7 ]]
[[ "$(sql "select count(*) from canonical_field_overrides where legacy_event_correction_id in('legacy-resolved','legacy-ignored')")" == 0 ]]
[[ "$(sql "select count(*) from canonical_field_overrides where entity_uuid='57100000-0000-4000-8000-000000000001' and actor_id='legacy-admin' and legacy_status='active'")" == 1 ]]
[[ "$(sql "select count(*) from provider_source_corrections where id='57100000-0000-4000-8000-000000000013' and status='active' and revision=1")" == 1 ]]
[[ "$(sql "select count(*) from canonical_field_overrides where canonical_record_id='57100000-0000-4000-8000-000000000012'")" == 0 ]]

# Deterministic replay is a no-op; divergent content for the same legacy identity is refused.
[[ "$(sql "select count(*) from canonical_field_overrides where legacy_event_correction_id='legacy-active'")" == 1 ]]
if sql "insert into canonical_field_overrides(id,entity_kind,entity_uuid,canonical_record_id,field_name,override_value,reason,actor_id,status,idempotency_key,request_fingerprint,legacy_event_correction_id) values(gen_random_uuid(),'event','57100000-0000-4000-8000-000000000001','f56-legacy-active','name','\"Divergent\"','bad','bad','active','bad','$(printf '0%.0s' {1..64})','legacy-active')" >/dev/null 2>&1;then echo 'F5-6 divergent legacy import accepted' >&2;exit 1;fi

# The legacy table is physically read-only after upgrade.
for mutation in \
  "insert into event_corrections(id,event_id,provider_key,field_name,status) values('forbidden','f56-legacy-active','x','name','active')" \
  "update event_corrections set override_value='\"x\"' where id='legacy-active'" \
  "delete from event_corrections where id='legacy-active'";do
  if sql "${mutation}" >/dev/null 2>&1;then echo 'F5-6 legacy Event correction write accepted' >&2;exit 1;fi
done

DATABASE_URL="postgresql://mse:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events" \
RUN_F5_RECONCILIATION_POSTGRES=1 npm test --workspace @mse/api -- --run tests/reconciliation.postgres.test.ts
DATABASE_URL="postgresql://mse:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events" \
RUN_F5_RECONCILIATION_POSTGRES=1 npm test --workspace @mse/api -- --run tests/acceptanceDataset.postgres.test.ts

# Once F5-6 evidence exists the DOWN must refuse without deleting legacy tables.
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0037_f5_multi_provider_reconciliation >/dev/null 2>&1;then echo 'F5-6 populated DOWN accepted' >&2;exit 1;fi
[[ "$(sql "select to_regclass('public.event_corrections') is not null and to_regclass('public.provider_source_corrections') is not null")" == t ]]
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0037_f5_multi_provider_reconciliation ]]

# Legacy storage is physically preserved and sealed against dual writes.
if sql "insert into event_corrections(id,event_id,provider_key,field_name,override_value) values('forbidden','missing','x','name','\"x\"')" >/dev/null 2>&1;then echo 'legacy Event correction write accepted' >&2;exit 1;fi
echo 'F5-6 multi-provider reconciliation PostgreSQL certification: PASS'
echo 'PROVIDER_CALLS=0 WORKER_STARTED=NO SCHEDULER_STARTED=NO PREPROD_ACCESSED=NO PRODUCTION_ACCESSED=NO'
