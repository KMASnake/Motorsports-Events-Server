#!/bin/sh
set -eu
PROJECT=${LOT57PF_RUNNER_PROJECT:-mse-lot57pf-bounded-runner}
POSTGRES_PORT=${LOT57PF_RUNNER_PORT:-55497}
PASSWORD=${LOT57PF_RUNNER_PASSWORD:-lot57pf-bounded-runner-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
update events set category='race',normalized_uuid='57000000-0000-4000-8000-000000003410',circuit_id='silverstone',starts_at='2026-07-05T14:00:00Z',external_id='british-gp' where id='evt-002';
insert into provider_instances(id,adapter_key,name,enabled,state,config,max_concurrency) values('57000000-0000-4000-8000-000000003401','ocblacktop','Bounded runner fixture',true,'active','{"base_url":"https://api.ocblacktop.com/v1"}',1);
insert into provider_quota_policies(provider_instance_id,minimum_interval_seconds) values('57000000-0000-4000-8000-000000003401',0);
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values('57000000-0000-4000-8000-000000003403','57000000-0000-4000-8000-000000003401','f1','formula1','active',true);
insert into provider_championship_source_configs(provider_championship_id,schema_version,config,validated_at) values('57000000-0000-4000-8000-000000003403',1,'{"strategy":"series-events-v1","external_id":"formula1","endpoint_template":"/{series}/events"}',now());
insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor,current_window_year) values('57000000-0000-4000-8000-000000003404','57000000-0000-4000-8000-000000003403','current','ready',1,'{"page":1,"visited":[]}',2026),('57000000-0000-4000-8000-000000003405','57000000-0000-4000-8000-000000003403','historical','ready',1,'{"page":1,"visited":[]}',null);
insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003406','57000000-0000-4000-8000-000000003403','runner-v1','rules-v1','{"championshipIds":{"formula1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race"},"statuses":{"Scheduled":"scheduled"}}','test');
insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values('57000000-0000-4000-8000-000000003407','57000000-0000-4000-8000-000000003403','runner-v2','rules-v2','{"championshipIds":{"formula1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race"},"statuses":{"Scheduled":"scheduled"}}','test');
insert into provider_championship_active_normalization_mappings(provider_championship_id,mapping_version_id,activated_at,activated_by) values('57000000-0000-4000-8000-000000003403','57000000-0000-4000-8000-000000003406',now(),'test');
SQL
node scripts/validate-lot57pf-bounded-provider-runner.mjs
echo 'PROVIDER_CALLS_EXTERNAL=0'
echo 'PROVIDER_CREDITS=0'
