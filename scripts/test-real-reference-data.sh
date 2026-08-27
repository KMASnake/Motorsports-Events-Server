#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-reference-data-${RANDOM}-$$"
export POSTGRES_PORT=$((56000 + RANDOM % 3000))
export POSTGRES_PASSWORD="reference-data-local-test"
DATABASE_URL="postgresql://mse:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events"
compose=(docker compose -p "${PROJECT}" -f "${ROOT}/docker-compose.yml")
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${compose[@]}" up -d postgres >/dev/null
for _ in $(seq 1 60); do
  if "${compose[@]}" exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null 2>&1; then break; fi
  sleep 1
done
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
sql(){ "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc "$1"; }

[ "$(sql "select count(*) from events")" = 0 ]
[ "$(sql "select count(*) from meetings")" = 0 ]
[ "$(sql "select count(*) from circuits")" = 26 ]
[ "$(sql "select count(*) from circuits where id in('lemans','monza','sachsenring','silverstone')")" = 4 ]
[ "$(sql "select count(*) from circuits where country_code is null or timezone not like '%/%'")" = 0 ]
[ "$(sql "select count(*) from schema_migrations where version='0031_real_circuit_reference_data'")" = 1 ]

sql "update circuits set name='Existing Monza preserved' where id='monza'" >/dev/null
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0031_real_circuit_reference_data >/dev/null
[ "$(sql "select name from circuits where id='monza'")" = 'Existing Monza preserved' ]
[ "$(sql "select count(*) from circuits")" = 4 ]
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
[ "$(sql "select count(*) from circuits")" = 26 ]
[ "$(sql "select name from circuits where id='monza'")" = 'Existing Monza preserved' ]
[ "$(sql "select count(*) from events")" = 0 ]
[ "$(sql "select count(*) from meetings")" = 0 ]

sql "insert into provider_instances(id,adapter_key,name,enabled,state) values('31000000-0000-4000-8000-000000000001','ocblacktop','Reference mapping fixture',false,'draft'); insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id) values('31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','f1','formula1')" >/dev/null
DATABASE_URL="${DATABASE_URL}" node "${ROOT}/scripts/manage-normalization-mapping.mjs" --action create --file "${ROOT}/infra/postgres/reference-data/ocblacktop-f1-v2.json" --provider-championship-id 31000000-0000-4000-8000-000000000002 --actor certification >/dev/null
[ "$(sql "select count(*) from normalization_mapping_versions where provider_championship_id='31000000-0000-4000-8000-000000000002'")" = 1 ]
[ "$(sql "select count(*) from provider_championship_active_normalization_mappings where provider_championship_id='31000000-0000-4000-8000-000000000002'")" = 0 ]
mapping_id="$(sql "select id from normalization_mapping_versions where provider_championship_id='31000000-0000-4000-8000-000000000002'")"
DATABASE_URL="${DATABASE_URL}" node "${ROOT}/scripts/manage-normalization-mapping.mjs" --action activate --file "${ROOT}/infra/postgres/reference-data/ocblacktop-f1-v2.json" --provider-championship-id 31000000-0000-4000-8000-000000000002 --mapping-id "${mapping_id}" --actor certification >/dev/null
[ "$(sql "select count(*) from provider_championship_active_normalization_mappings where provider_championship_id='31000000-0000-4000-8000-000000000002' and mapping_version_id='${mapping_id}'")" = 1 ]

# Une version stockée différente du fichier audité ne doit jamais pouvoir être
# activée en profitant de la validation du seul fichier local.
mismatched_mapping_id="31000000-0000-4000-8000-000000000003"
sql "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by)
values(
  '${mismatched_mapping_id}',
  '31000000-0000-4000-8000-000000000002',
  'mismatched-test',
  'v2',
  '{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{},\"sessionTypes\":{\"practice\":\"practice\"},\"statuses\":{\"scheduled\":\"scheduled\"}}'::jsonb,
  'certification'
)" >/dev/null

if DATABASE_URL="${DATABASE_URL}" node "${ROOT}/scripts/manage-normalization-mapping.mjs"   --action activate   --file "${ROOT}/infra/postgres/reference-data/ocblacktop-f1-v2.json"   --provider-championship-id 31000000-0000-4000-8000-000000000002   --mapping-id "${mismatched_mapping_id}"   --actor certification >/tmp/mse-reference-data-mismatch-$$.log 2>&1
then
  cat /tmp/mse-reference-data-mismatch-$$.log >&2
  rm -f /tmp/mse-reference-data-mismatch-$$.log
  echo "ERROR: mismatched stored mapping was activated" >&2
  exit 1
fi

grep -q 'Le document stocké ne correspond pas au fichier de mapping fourni'   /tmp/mse-reference-data-mismatch-$$.log
rm -f /tmp/mse-reference-data-mismatch-$$.log

[ "$(sql "select mapping_version_id from provider_championship_active_normalization_mappings where provider_championship_id='31000000-0000-4000-8000-000000000002'")" = "${mapping_id}" ]

"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -f /dev/stdin < "${ROOT}/scripts/audit-demo-business-data.sql" >/tmp/mse-reference-data-audit-$$.log
grep -q 'provider_source_entities' /tmp/mse-reference-data-audit-$$.log
rm -f /tmp/mse-reference-data-audit-$$.log

echo 'Reference data fresh/upgrade/down/up and dry-run audit: PASS'
echo 'FAKE_DATA_COUNT=0 REAL_REFERENCE_DATA_COUNT=29 MEETINGS=0 EVENTS=0 PROVIDER_CALLS=0'
