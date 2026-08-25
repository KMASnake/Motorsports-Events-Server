#!/bin/sh
set -eu
PROJECT=${LOT57PF_HANDOFF_PROJECT:-mse-lot57pf-canonical-handoff}
POSTGRES_PORT=${LOT57PF_HANDOFF_PORT:-55495}
PASSWORD=${LOT57PF_HANDOFF_PASSWORD:-lot57pf-canonical-handoff-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
update events set category='race',normalized_uuid='57000000-0000-4000-8000-000000003210',circuit_id='silverstone',starts_at='2026-07-05T14:00:00Z' where id='evt-002';
insert into meetings(id,championship_id,name,season,starts_at,timezone) values('57000000-0000-4000-8000-000000003211','f1','British Grand Prix',2026,'2026-07-05T10:00:00Z','Europe/London');
insert into meeting_events(meeting_id,event_id) values('57000000-0000-4000-8000-000000003211','evt-002');
insert into provider_instances(id,adapter_key,name,enabled,state) values('57000000-0000-4000-8000-000000003201','fixture','Canonical handoff fixture',false,'draft');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id) values('57000000-0000-4000-8000-000000003202','57000000-0000-4000-8000-000000003201','f1','formula1');
insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor) values('57000000-0000-4000-8000-000000003203','57000000-0000-4000-8000-000000003202','current','ready',1,'{}');
insert into provider_acquisition_traversals(id,stream_id,work_class,safe_unit_key,status,complete,finished_at,lease_generation)
values('57000000-0000-4000-8000-000000003204','57000000-0000-4000-8000-000000003203','current_hot','complete-1','complete',true,now(),1),
      ('57000000-0000-4000-8000-000000003205','57000000-0000-4000-8000-000000003203','current_hot','incomplete','partial',false,null,1),
      ('57000000-0000-4000-8000-000000003206','57000000-0000-4000-8000-000000003203','current_hot','unbound','complete',true,now(),1),
      ('57000000-0000-4000-8000-000000003207','57000000-0000-4000-8000-000000003203','current_hot','empty','empty_confirmed',true,now(),1);
insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,provider_started_at,provider_ended_at,first_observed_at,last_observed_at,last_changed_at,last_traversal_id)
values('57000000-0000-4000-8000-000000003208','57000000-0000-4000-8000-000000003201','57000000-0000-4000-8000-000000003202','event','british-gp',2026,'{"name":"British Grand Prix","session_type":"Race","status":"Scheduled","championship_id":"formula1","circuit_id":"silverstone","starts_at":"2026-07-05T14:00:00Z","timezone":"Europe/London"}','handoff-1','2026-07-05T14:00:00Z','2026-07-05T16:00:00Z',now(),now(),now(),'57000000-0000-4000-8000-000000003204');
insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at) values('57000000-0000-4000-8000-000000003204','57000000-0000-4000-8000-000000003208','present',now());
insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by)
values('57000000-0000-4000-8000-000000003209','57000000-0000-4000-8000-000000003202','v1','rules-v1','{"championshipIds":{"formula1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race"},"statuses":{"Scheduled":"scheduled"}}','test'),
      ('57000000-0000-4000-8000-000000003219','57000000-0000-4000-8000-000000003202','v2','rules-v2','{"championshipIds":{"formula1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race"},"statuses":{"Scheduled":"scheduled"}}','test');
insert into provider_championship_active_normalization_mappings values('57000000-0000-4000-8000-000000003202','57000000-0000-4000-8000-000000003219',now(),'test');
insert into provider_acquisition_traversal_mappings values
('57000000-0000-4000-8000-000000003204','57000000-0000-4000-8000-000000003202','57000000-0000-4000-8000-000000003209',now()),
('57000000-0000-4000-8000-000000003205','57000000-0000-4000-8000-000000003202','57000000-0000-4000-8000-000000003209',now()),
('57000000-0000-4000-8000-000000003207','57000000-0000-4000-8000-000000003202','57000000-0000-4000-8000-000000003209',now());
SQL
node scripts/validate-lot57pf-canonical-handoff.mjs
echo 'PROVIDER_CALLS=0'
echo 'PROVIDER_CREDITS=0'
