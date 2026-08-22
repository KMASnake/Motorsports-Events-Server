#!/bin/sh
set -eu
PROJECT=${LOT57PC_PROJECT:-mse-lot57pc-publication}
POSTGRES_PORT=${LOT57PC_POSTGRES_PORT:-55489}
PASSWORD=${LOT57PC_POSTGRES_PASSWORD:-lot57pc-publication-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
update events set normalized_uuid='57000000-0000-4000-8000-000000000210' where id='evt-002';
insert into provider_instances(id,adapter_key,name,enabled,state) values('57000000-0000-4000-8000-000000000211','lot57pc-fixture','C Fixture',true,'active');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values('57000000-0000-4000-8000-000000000212','57000000-0000-4000-8000-000000000211','f1','fixture-f1','configured','active',true);
insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values
('57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000211','57000000-0000-4000-8000-000000000212','event','race',1965,'{}','hash','1965-01-01','1965-01-01','1965-01-01');
insert into normalization_checkpoints(scope_key,normalization_version,fence_generation) values('f1:event-normalization','v1',7);
insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data) values
('57000000-0000-4000-8000-000000000201','57000000-0000-4000-8000-000000000213','h1','v1','event','{"normalized":{"resourceKind":"event","name":"Historic Race","status":"scheduled","championshipId":"f1","circuitId":"silverstone","startsAt":"1965-01-01T00:00:00.000Z","provenance":{"private":true}},"proposed_uuid":"57000000-0000-4000-8000-000000000210"}'),
('57000000-0000-4000-8000-000000000202','57000000-0000-4000-8000-000000000213','h2','v1','event','{"normalized":{"resourceKind":"event","name":"Historic Race","status":"scheduled","championshipId":"f1","circuitId":"silverstone","startsAt":"1965-01-01T00:00:00.000Z","provenance":{"changed":true}},"proposed_uuid":"57000000-0000-4000-8000-000000000210"}'),
('57000000-0000-4000-8000-000000000203','57000000-0000-4000-8000-000000000213','h3','v1','event','{"normalized":{"resourceKind":"event","name":"Historic Race","status":"postponed","championshipId":"f1","circuitId":"silverstone","startsAt":"1965-01-01T00:00:00.000Z"},"proposed_uuid":"57000000-0000-4000-8000-000000000210"}'),
('57000000-0000-4000-8000-000000000204','57000000-0000-4000-8000-000000000213','h4','v1','event','{"normalized":{"resourceKind":"event","name":"Unknown","championshipId":null,"circuitId":null},"proposed_uuid":"57000000-0000-4000-8000-000000000299"}'),
('57000000-0000-4000-8000-000000000205','57000000-0000-4000-8000-000000000213','h5','v1','event','{"normalized":{"resourceKind":"event","name":"Historic Race","status":"cancelled","championshipId":"f1","circuitId":"silverstone","startsAt":"1965-01-01T00:00:00.000Z"},"proposed_uuid":"57000000-0000-4000-8000-000000000210"}');
insert into normalization_decisions(id,source_entity_id,candidate_id,decision,target_kind,target_id,normalization_version,actor_id) values
('57000000-0000-4000-8000-000000000221','57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000201','linked','event','evt-002','v1','test'),
('57000000-0000-4000-8000-000000000222','57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000202','linked','event','evt-002','v1','test'),
('57000000-0000-4000-8000-000000000223','57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000203','linked','event','evt-002','v1','test'),
('57000000-0000-4000-8000-000000000224','57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000204','review',null,null,'v1','test'),
('57000000-0000-4000-8000-000000000225','57000000-0000-4000-8000-000000000213','57000000-0000-4000-8000-000000000205','linked','event','evt-002','v1','test');
SQL
node scripts/validate-lot57pc-publication.mjs
if docker compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null 2>&1; then
  echo 'destructive migration rollback unexpectedly succeeded' >&2; exit 1
fi
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
truncate publication_rebuild_checkpoints,publication_receipts,public_change_log,public_resource_states;
alter database motorsports_events set mse.allow_destructive_lot57pc_down='on';
SQL
docker compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from schema_migrations where version='0025_lot57pc_publication_state'" | grep -qx 1
echo 'C01-C35 publication/transaction/rebuild boundary: PASS'
