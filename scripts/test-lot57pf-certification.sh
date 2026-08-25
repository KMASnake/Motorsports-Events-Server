#!/bin/sh
set -eu

PROJECT=${LOT57PF_PROJECT:-mse-lot57pf-certification}
POSTGRES_PORT=${LOT57PF_POSTGRES_PORT:-55492}
PASSWORD=${LOT57PF_POSTGRES_PASSWORD:-lot57pf-certification-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
update events set category='race',normalized_uuid='57000000-0000-4000-8000-000000000610',circuit_id='silverstone',starts_at='2026-07-05T14:00:00Z' where id='evt-002';
insert into meetings(id,championship_id,name,season,starts_at,timezone)
values('57000000-0000-4000-8000-000000000611','f1','British Grand Prix',2026,'2026-07-05T10:00:00Z','Europe/London');
insert into meeting_events(meeting_id,event_id) values('57000000-0000-4000-8000-000000000611','evt-002');
insert into provider_instances(id,adapter_key,name,enabled,state)
values('57000000-0000-4000-8000-000000000601','lot57pf-replay','Lot 5.7-P-F controlled replay',true,'active');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary)
values('57000000-0000-4000-8000-000000000602','57000000-0000-4000-8000-000000000601','f1','fixture-f1','configured','active',true);
insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,provider_started_at,provider_ended_at,theoretical_end_at,end_estimated,end_provenance,first_observed_at,last_observed_at,last_changed_at)
values('57000000-0000-4000-8000-000000000603','57000000-0000-4000-8000-000000000601','57000000-0000-4000-8000-000000000602','event','british-gp',2026,'{"name":"British Grand Prix","session_type":"Race","status":"Scheduled","championship_id":"fixture-f1","circuit_id":"silverstone","starts_at":"2026-07-05T15:00:00+01:00","timezone":"Europe/London"}','f1-replay-1','2026-07-05T14:00:00Z','2026-07-05T16:00:00Z','2026-07-05T16:00:00Z',false,'provider','2026-07-01T00:00:00Z','2026-07-01T00:00:00Z','2026-07-01T00:00:00Z');
insert into normalization_checkpoints(scope_key,normalization_version,fence_generation)
values('f1:certification','f1-preview-v1',11);
SQL

node scripts/validate-lot57pf-certification.mjs
echo 'PP-T36 controlled F1 replay certification: PASS'
echo 'PROVIDER_CALLS=0'
echo 'PROVIDER_CREDITS=0'
