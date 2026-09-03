#!/bin/sh
set -eu
PROJECT=${LOT57PF_MAPPING_REPOSITORY_PROJECT:-mse-lot57pf-mapping-repository}
POSTGRES_PORT=${LOT57PF_MAPPING_REPOSITORY_PORT:-55494}
PASSWORD=${LOT57PF_MAPPING_REPOSITORY_PASSWORD:-lot57pf-mapping-repository-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
insert into provider_instances(id,adapter_key,name,enabled,state)
values('57000000-0000-4000-8000-000000003091','fixture','Repository owner one',false,'draft'),
      ('57000000-0000-4000-8000-000000003092','fixture','Repository owner two',false,'draft');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id)
values('57000000-0000-4000-8000-000000003101','57000000-0000-4000-8000-000000003091','f1','formula1'),
      ('57000000-0000-4000-8000-000000003102','57000000-0000-4000-8000-000000003092','f1','formula2');
insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor)
values('57000000-0000-4000-8000-000000003111','57000000-0000-4000-8000-000000003101','current','ready',1,'{}'),
      ('57000000-0000-4000-8000-000000003112','57000000-0000-4000-8000-000000003101','historical','ready',1,'{}');
insert into provider_acquisition_traversals(id,stream_id,work_class,safe_unit_key,status,complete,finished_at,lease_generation)
values('57000000-0000-4000-8000-000000003121','57000000-0000-4000-8000-000000003111','current_hot','repository-current','complete',true,now(),1),
      ('57000000-0000-4000-8000-000000003122','57000000-0000-4000-8000-000000003112','recent_catchup','legacy-unbound','partial',false,null,1);
SQL
node scripts/validate-lot57pf-normalization-mapping-repository.mjs
