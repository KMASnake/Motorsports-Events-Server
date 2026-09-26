#!/bin/sh
set -eu

PROJECT=${LOT57PF_MAPPING_PROJECT:-mse-lot57pf-normalization-mapping}
POSTGRES_PORT=${LOT57PF_MAPPING_POSTGRES_PORT:-55493}
PASSWORD=${LOT57PF_MAPPING_POSTGRES_PASSWORD:-lot57pf-normalization-mapping-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
sql(){ docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"; }
reject(){ label=$1; statement=$2; if sql "$statement" >/dev/null 2>&1; then echo "$label should have been rejected" >&2; exit 1; fi; }
trap cleanup EXIT INT TERM

cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

[ "$(sql "select count(*) from schema_migrations where version='0030_lot57pf_normalization_mapping_persistence'")" = 1 ]
[ "$(sql 'select (select count(*) from normalization_mapping_versions)+(select count(*) from provider_championship_active_normalization_mappings)+(select count(*) from provider_acquisition_traversal_mappings)')" = 0 ]

# Empty down/up proves both a fresh application and an additive upgrade from 0029.
docker compose run --rm migrate sh /migrations/migrate.sh down 0030_lot57pf_normalization_mapping_persistence >/dev/null
[ "$(sql "select to_regclass('public.normalization_mapping_versions') is null")" = t ]
docker compose run --rm migrate >/dev/null

sql "
insert into provider_instances(id,adapter_key,name,enabled,state)
values('57000000-0000-4000-8000-000000003001','fixture','Mapping owner one',false,'draft'),
      ('57000000-0000-4000-8000-000000003002','fixture','Mapping owner two',false,'draft');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id)
values('57000000-0000-4000-8000-000000003011','57000000-0000-4000-8000-000000003001','f1','formula1'),
      ('57000000-0000-4000-8000-000000003012','57000000-0000-4000-8000-000000003002','f1','formula2');
insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor)
values('57000000-0000-4000-8000-000000003021','57000000-0000-4000-8000-000000003011','current','ready',1,'{}'),
      ('57000000-0000-4000-8000-000000003022','57000000-0000-4000-8000-000000003011','historical','ready',1,'{}');
insert into provider_acquisition_traversals(id,stream_id,work_class,safe_unit_key,status,complete,finished_at,lease_generation)
values('57000000-0000-4000-8000-000000003031','57000000-0000-4000-8000-000000003021','current_hot','complete','complete',true,now(),1),
      ('57000000-0000-4000-8000-000000003032','57000000-0000-4000-8000-000000003022','recent_catchup','legacy-unbound','partial',false,null,1);
"

valid='{"championshipIds":{"formula1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race"},"statuses":{"Scheduled":"scheduled"}}'
valid_two='{"championshipIds":{"formula2":"f1"},"circuitIds":{},"sessionTypes":{},"statuses":{}}'

sql "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003041','57000000-0000-4000-8000-000000003011','v1','rules-v1','$valid','test')"
sql "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003042','57000000-0000-4000-8000-000000003011','unused','rules-v1','$valid','test')"
sql "delete from normalization_mapping_versions where id='57000000-0000-4000-8000-000000003042'"

reject malformed "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003050','57000000-0000-4000-8000-000000003011','bad-json','rules-v1','[]',now(),'test')"
reject unknown_key "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003051','57000000-0000-4000-8000-000000003011','bad-key','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{},\"sessionTypes\":{},\"statuses\":{},\"extra\":{}}',now(),'test')"
reject missing_section "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003052','57000000-0000-4000-8000-000000003011','missing','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{},\"sessionTypes\":{}}',now(),'test')"
reject non_object_section "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003059','57000000-0000-4000-8000-000000003011','non-object','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":[],\"sessionTypes\":{},\"statuses\":{}}',now(),'test')"
reject bad_championship "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003053','57000000-0000-4000-8000-000000003011','bad-champ','rules-v1','{\"championshipIds\":{\"formula1\":\"unknown\"},\"circuitIds\":{},\"sessionTypes\":{},\"statuses\":{}}',now(),'test')"
reject bad_circuit "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003054','57000000-0000-4000-8000-000000003011','bad-circuit','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{\"x\":\"unknown\"},\"sessionTypes\":{},\"statuses\":{}}',now(),'test')"
reject bad_session "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003055','57000000-0000-4000-8000-000000003011','bad-session','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{},\"sessionTypes\":{\"Race\":\"invalid\"},\"statuses\":{}}',now(),'test')"
reject bad_status "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003056','57000000-0000-4000-8000-000000003011','bad-status','rules-v1','{\"championshipIds\":{\"formula1\":\"f1\"},\"circuitIds\":{},\"sessionTypes\":{},\"statuses\":{\"Done\":\"invalid\"}}',now(),'test')"
reject wrong_owner_mapping "insert into normalization_mapping_versions values('57000000-0000-4000-8000-000000003057','57000000-0000-4000-8000-000000003012','wrong-owner','rules-v1','$valid',now(),'test')"
reject duplicate_label "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003058','57000000-0000-4000-8000-000000003011','v1','rules-v2','$valid','test')"
reject immutable_update "update normalization_mapping_versions set rules_version='rules-v2' where id='57000000-0000-4000-8000-000000003041'"

sql "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003043','57000000-0000-4000-8000-000000003011','v2','rules-v2','$valid','test')"
sql "insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003044','57000000-0000-4000-8000-000000003012','v1','rules-v1','$valid_two','test')"
sql "insert into provider_championship_active_normalization_mappings values('57000000-0000-4000-8000-000000003011','57000000-0000-4000-8000-000000003041',now(),'test')"
reject active_delete "delete from normalization_mapping_versions where id='57000000-0000-4000-8000-000000003041'"
reject active_wrong_owner "update provider_championship_active_normalization_mappings set mapping_version_id='57000000-0000-4000-8000-000000003044' where provider_championship_id='57000000-0000-4000-8000-000000003011'"
sql "update provider_championship_active_normalization_mappings set mapping_version_id='57000000-0000-4000-8000-000000003043',activated_at=now(),activated_by='test-v2' where provider_championship_id='57000000-0000-4000-8000-000000003011'"

reject traversal_wrong_owner "insert into provider_acquisition_traversal_mappings values('57000000-0000-4000-8000-000000003031','57000000-0000-4000-8000-000000003012','57000000-0000-4000-8000-000000003044',now())"
sql "insert into provider_acquisition_traversal_mappings values('57000000-0000-4000-8000-000000003031','57000000-0000-4000-8000-000000003011','57000000-0000-4000-8000-000000003041',now())"
reject binding_update "update provider_acquisition_traversal_mappings set mapping_version_id='57000000-0000-4000-8000-000000003043' where traversal_id='57000000-0000-4000-8000-000000003031'"
reject binding_delete "delete from provider_acquisition_traversal_mappings where traversal_id='57000000-0000-4000-8000-000000003031'"
reject bound_mapping_delete "delete from normalization_mapping_versions where id='57000000-0000-4000-8000-000000003041'"
[ "$(sql "select count(*) from provider_acquisition_traversal_mappings where traversal_id='57000000-0000-4000-8000-000000003032'")" = 0 ]

if docker compose run --rm migrate sh /migrations/migrate.sh down 0030_lot57pf_normalization_mapping_persistence >/dev/null 2>&1; then
  echo '0030 populated rollback should have been refused' >&2
  exit 1
fi

echo '0030 fresh/upgrade/down/up, validation, immutability and binding: PASS'
