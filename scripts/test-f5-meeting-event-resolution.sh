#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-f5-meeting-event-${RANDOM}-$$"
export POSTGRES_PORT=$((58000 + RANDOM % 1000)) POSTGRES_PASSWORD='f5-meeting-event-local-test'
compose=(docker compose -p "${PROJECT}" -f "${ROOT}/docker-compose.yml")
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" up -d postgres >/dev/null
for _ in $(seq 1 60);do "${compose[@]}" exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null 2>&1&&break;sleep 1;done
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
sql(){ "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc "$1"; }
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0036_f5_meeting_event_canonical_resolution ]]

# Empty DOWN and re-upgrade are reversible.
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0036_f5_meeting_event_canonical_resolution >/dev/null
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0035_f5_provider_discovery_resolution ]]
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null

DATABASE_URL="postgresql://mse:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events" \
RUN_F5_MEETING_EVENT_POSTGRES=1 npm test --workspace @mse/api -- --run tests/meetingEventResolution.postgres.test.ts

"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
insert into championship_seasons(id,championship_id,key,label,start_year,end_year)
values('55000000-0000-4000-8000-000000000001','f1','f1-2026','F1 2026',2026,2026),
      ('55000000-0000-4000-8000-000000000002','f1','f1-alt-2026','F1 Alternate 2026',2026,2026),
      ('55000000-0000-4000-8000-000000000003','motogp','motogp-2026','MotoGP 2026',2026,2026);
insert into venues(id,key,name,kind_key) values
 ('55000000-0000-4000-8000-000000000010','f5-test-circuit','F5 Test Circuit','circuit'),
 ('55000000-0000-4000-8000-000000000011','f5-rally-location','F5 Rally Location','rally_location');
insert into venue_layouts(id,venue_id,key,name) values
 ('55000000-0000-4000-8000-000000000020','55000000-0000-4000-8000-000000000010','gp','Grand Prix');
insert into meetings(id,championship_id,championship_season_id,name,season,starts_at,timezone,venue_id,venue_layout_id)
values('55000000-0000-4000-8000-000000000030','f1','55000000-0000-4000-8000-000000000001','F5 Test GP',2026,'2026-06-01T10:00:00Z','UTC','55000000-0000-4000-8000-000000000010','55000000-0000-4000-8000-000000000020');
begin;
insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin,normalized_uuid,venue_id,venue_layout_id)
values('f5-event','f1','FP1','f5-event','practice','practice','2026-06-01T10:00:00Z','UTC','scheduled',true,'provider','55000000-0000-4000-8000-000000000040','55000000-0000-4000-8000-000000000010','55000000-0000-4000-8000-000000000020');
insert into meeting_events(meeting_id,event_id) values('55000000-0000-4000-8000-000000000030','f5-event');
commit;
-- WRC-style Event Venue may differ from Meeting and need no fabricated Circuit.
begin;
insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin,normalized_uuid,venue_id)
values('f5-stage','f1','Stage 1','f5-stage','race','stage','2026-06-01T11:00:00Z','UTC','scheduled',true,'provider','55000000-0000-4000-8000-000000000041','55000000-0000-4000-8000-000000000011');
insert into meeting_events(meeting_id,event_id) values('55000000-0000-4000-8000-000000000030','f5-stage');
commit;
SQL

expect_refusal(){ if "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -c "$1" >/dev/null 2>&1;then echo "$2" >&2;exit 1;fi; }
expect_refusal "begin;insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin,normalized_uuid) values('f5-orphan','f1','Orphan','f5-orphan','other','other',now(),'UTC','scheduled',false,'provider','55000000-0000-4000-8000-000000000042');set constraints all immediate;commit" 'canonical orphan accepted'
expect_refusal "begin;delete from meeting_events where event_id='f5-event';set constraints all immediate;commit" 'canonical parent removal accepted'
expect_refusal "update events set championship_id='wec' where id='f5-event'" 'cross-Championship Event accepted'
expect_refusal "update meetings set championship_season_id=null,championship_id='motogp' where id='55000000-0000-4000-8000-000000000030'" 'cross-Championship Meeting mutation accepted'
expect_refusal "begin;insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values('55000000-0000-4000-8000-000000000031','motogp','55000000-0000-4000-8000-000000000003','MotoGP Meeting',2026,'UTC');update meeting_events set meeting_id='55000000-0000-4000-8000-000000000031' where event_id='f5-event';set constraints all immediate;commit" 'cross-Championship parent reassignment accepted'
expect_refusal "update events set venue_id='55000000-0000-4000-8000-000000000011' where id='f5-event'" 'cross-Venue Layout accepted'

# A coherent deferred Championship change remains possible atomically.
sql "begin;update events set championship_id='motogp' where id in('f5-event','f5-stage');update meetings set championship_id='motogp',championship_season_id='55000000-0000-4000-8000-000000000003' where id='55000000-0000-4000-8000-000000000030';set constraints all immediate;commit"
[[ "$(sql "select event.championship_id||'/'||meeting.championship_id from events event join meeting_events relation on relation.event_id=event.id join meetings meeting on meeting.id=relation.meeting_id where event.id='f5-event'")" == motogp/motogp ]]

[[ "$(sql "select count(*) from meeting_events where event_id in('f5-event','f5-stage')")" == 2 ]]
[[ "$(sql "select count(*) from information_schema.columns where table_name='events' and column_name='championship_season_id'")" == 0 ]]
[[ "$(sql "select count(*) from pg_trigger where tgname in('events_canonical_parent_required','meeting_events_canonical_parent_integrity','meetings_canonical_child_integrity','normalization_decisions_apply_state','normalization_decisions_immutable') and not tgisinternal")" == 5 ]]
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0036_f5_meeting_event_canonical_resolution >/dev/null 2>&1;then echo 'F5-5 populated DOWN accepted' >&2;exit 1;fi
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0036_f5_meeting_event_canonical_resolution ]]
echo 'F5-5 Meeting/Event canonical resolution PostgreSQL certification: PASS'
echo 'PROVIDER_CALLS=0 WORKER_STARTED=NO SCHEDULER_STARTED=NO PREPROD_ACCESSED=NO PRODUCTION_ACCESSED=NO'
