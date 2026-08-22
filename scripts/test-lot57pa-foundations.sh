#!/bin/sh
set -eu

PROJECT=${LOT57PA_PROJECT:-mse-lot57pa-foundations}
POSTGRES_PORT=${LOT57PA_POSTGRES_PORT:-55487}
PASSWORD=${LOT57PA_POSTGRES_PASSWORD:-lot57pa-foundations-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

echo 'A01 — fresh PostgreSQL to migration head'
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists(select 1 from schema_migrations where version='0024_lot57pa_normalized_persistence') then raise exception '0024 missing'; end if;
  if (select count(*) from information_schema.tables where table_schema='public' and table_name in (
    'meetings','meeting_events','normalized_identity_tombstones','event_source_links',
    'meeting_source_links','normalized_candidates','normalization_decisions','normalization_checkpoints'
  ))<>8 then raise exception 'Lot 5.7-P-A tables missing'; end if;
end $$;
SQL

echo 'A02 — current pre-A database upgrade preserves legacy data'
docker compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0024_lot57pa_normalized_persistence >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "update events set description='lot57pa-preserved' where id='evt-001';"
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "select 'current DB preserved' where (select description='lot57pa-preserved' from events where id='evt-001');"

echo 'A04-A16 — persistence, identity, constraints, transactions and restart'
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
insert into provider_instances(id,adapter_key,name,enabled,state)
values('57000000-0000-4000-8000-000000000001','lot57pa-fixture','Lot 5.7-P-A Fixture',true,'active');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary)
values('57000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000001','f1','fixture-f1','configured','active',true);
insert into provider_source_entities(
  id,provider_instance_id,provider_championship_id,entity_kind,external_id,source_data,source_hash,
  provider_started_at,first_observed_at,last_observed_at,last_changed_at
) values
('57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002','event','historic-event','{"name":"Historic Event"}','event-hash','1965-05-01T10:00:00Z',now(),now(),'1965-05-01T10:00:00Z'),
('57000000-0000-4000-8000-000000000004','57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002','meeting','historic-meeting','{"name":"Historic Meeting"}','meeting-hash','1965-05-01T09:00:00Z',now(),now(),'1965-05-01T09:00:00Z'),
('57000000-0000-4000-8000-000000000005','57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002','event','concurrent-event','{}','concurrent-hash','1965-05-02T10:00:00Z',now(),now(),'1965-05-02T10:00:00Z');

update events set normalized_uuid='57000000-0000-4000-8000-000000000010' where id='evt-002';
insert into meetings(id,championship_id,name,season,starts_at,ends_at,timezone)
values('57000000-0000-4000-8000-000000000011','f1','Historic Meeting',1965,'1965-05-01T09:00:00Z','1965-05-02T18:00:00Z','Europe/Paris');
insert into meeting_events(meeting_id,event_id,position)
values('57000000-0000-4000-8000-000000000011','evt-002',0);
insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version,linked_at)
values('57000000-0000-4000-8000-000000000003','evt-002','57000000-0000-4000-8000-000000000010','foundation-v1','1965-05-01T10:00:00Z');
insert into meeting_source_links(source_entity_id,meeting_id,normalization_version,linked_at)
values('57000000-0000-4000-8000-000000000004','57000000-0000-4000-8000-000000000011','foundation-v1','1965-05-01T09:00:00Z');
insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data,created_at,updated_at)
values('57000000-0000-4000-8000-000000000020','57000000-0000-4000-8000-000000000003','event-hash','foundation-v1','event','{"name":"Historic Event"}','1965-05-01T10:00:00Z','1965-05-01T10:00:00Z');
insert into normalization_decisions(id,source_entity_id,candidate_id,decision,normalization_version,actor_id,decided_at)
values('57000000-0000-4000-8000-000000000021','57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000020','create','foundation-v1','test','1965-05-01T10:00:00Z');
insert into normalization_checkpoints(scope_key,normalization_version,last_source_entity_id,last_source_changed_at,fence_generation)
values('f1:foundation','foundation-v1','57000000-0000-4000-8000-000000000003','1965-05-01T10:00:00Z',7);
insert into normalized_identity_tombstones(normalized_uuid,resource_kind,resource_id,tombstoned_at)
values('57000000-0000-4000-8000-000000000099','event','removed-event','1960-01-01T00:00:00Z');

do $$ begin
  if (select count(*) from meeting_events where event_id='evt-002')<>1 then raise exception 'Meeting/Event persistence failed'; end if;
  if (select normalized_event_uuid from event_source_links where source_entity_id='57000000-0000-4000-8000-000000000003')<>'57000000-0000-4000-8000-000000000010'::uuid then raise exception 'Event source link failed'; end if;
  if (select meeting_id from meeting_source_links where source_entity_id='57000000-0000-4000-8000-000000000004')<>'57000000-0000-4000-8000-000000000011'::uuid then raise exception 'Meeting source link failed'; end if;
  if (select extract(year from last_source_changed_at) from normalization_checkpoints where scope_key='f1:foundation')<>1965 then raise exception 'Pre-1970 failed'; end if;
end $$;

begin;
insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data)
values('57000000-0000-4000-8000-000000000030','57000000-0000-4000-8000-000000000003','rollback-hash','foundation-v1','event','{}');
rollback;
select 'transaction rollback' where not exists(select 1 from normalized_candidates where id='57000000-0000-4000-8000-000000000030');
SQL

reject(){
  label=$1
  sql=$2
  if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
    echo "$label should have been rejected" >&2
    exit 1
  fi
  echo "$label: rejected as expected"
}

reject 'duplicate Event source link' "insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values('57000000-0000-4000-8000-000000000003','evt-002','57000000-0000-4000-8000-000000000010','foundation-v2')"
reject 'duplicate Meeting/Event relation' "insert into meeting_events(meeting_id,event_id) values('57000000-0000-4000-8000-000000000011','evt-002')"
reject 'duplicate candidate identity' "insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data) values('57000000-0000-4000-8000-000000000031','57000000-0000-4000-8000-000000000003','event-hash','foundation-v1','event','{}')"
reject 'invalid automatic decision value' "insert into normalization_decisions(id,source_entity_id,decision,normalization_version,actor_id) values('57000000-0000-4000-8000-000000000032','57000000-0000-4000-8000-000000000003','auto_match','foundation-v1','test')"
reject 'duplicate decision identity with nullable target' "insert into normalization_decisions(id,source_entity_id,candidate_id,decision,normalization_version,actor_id) values('57000000-0000-4000-8000-000000000033','57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000020','create','foundation-v1','other-actor')"
reject 'tombstoned UUID reuse by Event' "update events set normalized_uuid='57000000-0000-4000-8000-000000000099' where id='evt-001'"
reject 'active Event UUID tombstone' "insert into normalized_identity_tombstones(normalized_uuid,resource_kind,resource_id,tombstoned_at) values('57000000-0000-4000-8000-000000000010','event','evt-002','1961-01-01T00:00:00Z')"

echo 'A07/A09 — concurrent unique constraints'
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "update events set normalized_uuid='57000000-0000-4000-8000-000000000012' where id='evt-001';"
set +e
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "begin; insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values('57000000-0000-4000-8000-000000000005','evt-001','57000000-0000-4000-8000-000000000012','foundation-v1'); select pg_sleep(1); commit;" >/tmp/lot57pa-link-race-a.log 2>&1 &
link_a=$!
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values('57000000-0000-4000-8000-000000000005','evt-001','57000000-0000-4000-8000-000000000012','foundation-v1');" >/tmp/lot57pa-link-race-b.log 2>&1 &
link_b=$!
wait "$link_a"; link_status_a=$?
wait "$link_b"; link_status_b=$?
[ $((link_status_a+link_status_b)) -eq 1 ] || { echo "Concurrent source-link race expected one success: $link_status_a/$link_status_b" >&2; exit 1; }

docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data) values('57000000-0000-4000-8000-000000000041','57000000-0000-4000-8000-000000000004','race-hash','foundation-v1','meeting','{}'); select pg_sleep(1);" >/tmp/lot57pa-race-a.log 2>&1 &
race_a=$!
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data) values('57000000-0000-4000-8000-000000000042','57000000-0000-4000-8000-000000000004','race-hash','foundation-v1','meeting','{}');" >/tmp/lot57pa-race-b.log 2>&1 &
race_b=$!
wait "$race_a"; status_a=$?
wait "$race_b"; status_b=$?
set -e
[ $((status_a+status_b)) -eq 1 ] || { echo "Concurrent candidate race expected one success: $status_a/$status_b" >&2; exit 1; }
docker compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from event_source_links where source_entity_id='57000000-0000-4000-8000-000000000005'" | grep -qx 1
docker compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from normalized_candidates where source_hash='race-hash'" | grep -qx 1

echo 'A12 — concurrent checkpoint monotonicity'
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -Atc "begin; update normalization_checkpoints set last_source_changed_at='1966-01-01T00:00:00Z',revision=revision+1 where scope_key='f1:foundation' and fence_generation=7 and last_source_changed_at<='1966-01-01T00:00:00Z' returning revision; select pg_sleep(1); commit;" >/tmp/lot57pa-checkpoint-new.log 2>&1 &
checkpoint_new=$!
sleep 1
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -Atc "update normalization_checkpoints set last_source_changed_at='1964-01-01T00:00:00Z',revision=revision+1 where scope_key='f1:foundation' and fence_generation=7 and last_source_changed_at<='1964-01-01T00:00:00Z' returning revision;" >/tmp/lot57pa-checkpoint-old.log 2>&1 &
checkpoint_old=$!
wait "$checkpoint_new"
wait "$checkpoint_old"
set -e
docker compose exec -T postgres psql -U mse -d motorsports_events -Atc "select (last_source_changed_at='1966-01-01T00:00:00Z'::timestamptz and revision=2)::int from normalization_checkpoints where scope_key='f1:foundation'" | grep -qx 1

echo 'A16 — repository state survives process restart'
docker compose restart postgres >/dev/null
docker compose exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -Atc "select count(*) from event_source_links" | grep -qx 2

echo 'A03 — destructive down refusal, cleanup, rollback and reapply'
docker compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null
if docker compose run --rm migrate sh /migrations/migrate.sh down 0024_lot57pa_normalized_persistence >/dev/null 2>&1; then
  echo 'Populated destructive rollback should have been refused' >&2
  exit 1
fi
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
truncate normalization_checkpoints,normalization_decisions,normalized_candidates,meeting_source_links,event_source_links,normalized_identity_tombstones,meeting_events,meetings;
update events set normalized_uuid=null,normalized_lifecycle='active';
SQL
docker compose run --rm migrate sh /migrations/migrate.sh down 0024_lot57pa_normalized_persistence >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "select 'rollback/reapply' where exists(select 1 from schema_migrations where version='0024_lot57pa_normalized_persistence') and to_regclass('public.normalization_checkpoints') is not null;"

echo 'Lot 5.7-P-A PostgreSQL foundations: PASS'
