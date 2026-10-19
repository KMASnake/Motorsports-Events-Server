#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-f5-venues-${RANDOM}-$$"
export POSTGRES_PORT=$((59000 + RANDOM % 1000)) POSTGRES_PASSWORD='f5-venues-local-test'
compose=(docker compose -p "${PROJECT}" -f "${ROOT}/docker-compose.yml")
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" up -d postgres >/dev/null
for _ in $(seq 1 60);do "${compose[@]}" exec -T postgres pg_isready -U mse -d motorsports_events >/dev/null 2>&1&&break;sleep 1;done
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
sql(){ "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atc "$1"; }
fail_sql(){ if sql "$1" >/dev/null 2>&1;then echo "$2" >&2;exit 1;fi; }
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0034_f5_canonical_venues ]]
[[ "$(sql "select count(*) from venues")" == 0 && "$(sql "select count(*) from venue_layouts")" == 0 && "$(sql "select count(*) from circuit_venue_links")" == 0 ]]
[[ "$(sql "select count(*) from venue_kinds")" == 7 ]]
sql "insert into championship_seasons(id,championship_id,key,label) values('34000000-0000-4000-8000-000000000090','f1','f5-venue-stable','Stable season');
insert into meetings(id,championship_id,name,season,championship_season_id) values('34000000-0000-4000-8000-000000000091','f1','Stable meeting',2026,'34000000-0000-4000-8000-000000000090');
insert into events(id,championship_id,name,slug,starts_at,circuit_id) values('f5-venue-stable-event','f1','Stable event','f5-venue-stable-event','2026-01-01T00:00:00Z','silverstone');" >/dev/null
before="$(sql "select id from championship_seasons where id='34000000-0000-4000-8000-000000000090';select id from meetings where id='34000000-0000-4000-8000-000000000091';select id||':'||circuit_id from events where id='f5-venue-stable-event';select string_agg(id,',' order by id) from circuits")"

sql "insert into venue_kinds(key,label) values('hill_climb','Course de côte');
insert into venues(id,key,name,kind_key,city,country_code,timezone,latitude,longitude) values
('34000000-0000-4000-8000-000000000001','silverstone-venue','Silverstone','circuit','Silverstone','GB','Europe/London',52.0786,-1.0169),
('34000000-0000-4000-8000-000000000002','monaco-venue','Monaco','street_circuit','Monaco','MC','Europe/Monaco',43.7347,7.4206);
insert into venue_layouts(id,venue_id,key,name) values
('34000000-0000-4000-8000-000000000011','34000000-0000-4000-8000-000000000001','grand-prix','Grand Prix'),
('34000000-0000-4000-8000-000000000012','34000000-0000-4000-8000-000000000001','national','National'),
('34000000-0000-4000-8000-000000000013','34000000-0000-4000-8000-000000000002','grand-prix','Grand Prix');" >/dev/null

fail_sql "insert into venues(id,key,name,kind_key) values(gen_random_uuid(),'silverstone-venue','Duplicate','circuit')" 'duplicate Venue key accepted'
fail_sql "insert into venues(id,key,name,kind_key) values(gen_random_uuid(),'   ','Bad','circuit')" 'whitespace Venue key accepted'
fail_sql "insert into venues(id,key,name,kind_key) values(gen_random_uuid(),'bad-name','   ','circuit')" 'whitespace Venue name accepted'
fail_sql "insert into venues(id,key,name,kind_key) values(gen_random_uuid(),'bad-kind','Bad','missing')" 'invalid kind accepted'
fail_sql "insert into venue_layouts(id,venue_id,key,name) values(gen_random_uuid(),'34000000-0000-4000-8000-000000000001','grand-prix','Duplicate')" 'duplicate Layout key accepted'
for values in "48,null" "null,2" "-91,2" "91,2" "48,-181" "48,181";do
  fail_sql "insert into venues(id,key,name,kind_key,latitude,longitude) values(gen_random_uuid(),'invalid-${RANDOM}','Bad','other',${values})" 'invalid coordinates accepted'
done

sql "update venues set name='Silverstone Circuit',city='Towcester',kind_key='test_track' where key='silverstone-venue';
update venue_layouts set name='Grand Prix Circuit' where venue_id='34000000-0000-4000-8000-000000000001' and key='grand-prix';" >/dev/null
venue_uuid="$(sql "select id from venues where key='silverstone-venue'")"
layout_uuid="$(sql "select id from venue_layouts where venue_id='34000000-0000-4000-8000-000000000001' and key='grand-prix'")"
[[ "${venue_uuid}" == 34000000-0000-4000-8000-000000000001 && "${layout_uuid}" == 34000000-0000-4000-8000-000000000011 ]]
fail_sql "update venues set key='changed' where id='34000000-0000-4000-8000-000000000001'" 'Venue key mutation accepted'
fail_sql "update venue_layouts set key='changed' where id='34000000-0000-4000-8000-000000000011'" 'Layout key mutation accepted'

sql "insert into circuit_venue_links(circuit_id,venue_id,venue_layout_id) values('silverstone','34000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000011')" >/dev/null
fail_sql "update circuit_venue_links set venue_id='34000000-0000-4000-8000-000000000002' where circuit_id='silverstone'" 'cross-Venue Layout mapping accepted'
fail_sql "delete from venues where id='34000000-0000-4000-8000-000000000001'" 'referenced Venue delete accepted'
fail_sql "delete from venue_layouts where id='34000000-0000-4000-8000-000000000011'" 'referenced Layout delete accepted'
fail_sql "delete from circuits where id='silverstone'" 'linked Circuit delete accepted'

for state in linked;do
  if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null 2>&1;then echo "down accepted while ${state}" >&2;exit 1;fi
  [[ "$(sql "select to_regclass('public.venues')||':'||to_regclass('public.venue_layouts')||':'||to_regclass('public.circuit_venue_links')")" == venues:venue_layouts:circuit_venue_links ]]
  [[ "$(sql "select count(*) from pg_constraint where conname='circuit_venue_links_layout_scope_fk'")" == 1 ]]
  [[ "$(sql "select count(*) from circuit_venue_links;select count(*) from venue_layouts;select count(*) from venues")" == $'1\n3\n2' ]]
done
sql "delete from circuit_venue_links" >/dev/null
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null 2>&1;then echo 'down accepted while Layout populated' >&2;exit 1;fi
[[ "$(sql "select count(*) from venue_layouts")" == 3 ]]
[[ "$(sql "select count(*) from pg_constraint where conname='circuit_venue_links_layout_scope_fk'")" == 1 ]]
sql "delete from venue_layouts" >/dev/null
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null 2>&1;then echo 'down accepted while Venue populated' >&2;exit 1;fi
[[ "$(sql "select count(*) from venues")" == 2 ]]
[[ "$(sql "select to_regclass('public.venues')||':'||to_regclass('public.venue_layouts')||':'||to_regclass('public.circuit_venue_links')")" == venues:venue_layouts:circuit_venue_links ]]
[[ "$(sql "select count(*) from pg_constraint where conname='circuit_venue_links_layout_scope_fk'")" == 1 ]]
sql "delete from venues" >/dev/null
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null 2>&1;then echo 'down accepted while VenueKind extension populated' >&2;exit 1;fi
sql "delete from venue_kinds where key='hill_climb';create table f5_future_venue_reference(venue_id uuid references venues(id));" >/dev/null
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null 2>&1;then echo 'down accepted with future dependency' >&2;exit 1;fi
[[ "$(sql "select to_regclass('public.f5_future_venue_reference')")" == f5_future_venue_reference ]]
sql "drop table f5_future_venue_reference" >/dev/null
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0034_f5_canonical_venues >/dev/null
[[ "$(sql "select to_regclass('public.venues') is null")" == t ]]
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0034_f5_canonical_venues ]]
[[ "$(sql "select id from championship_seasons where id='34000000-0000-4000-8000-000000000090';select id from meetings where id='34000000-0000-4000-8000-000000000091';select id||':'||circuit_id from events where id='f5-venue-stable-event';select string_agg(id,',' order by id) from circuits")" == "${before}" ]]
echo 'F5-3 Venue/Layout fresh/upgrade/down/re-upgrade certification: PASS'
echo 'BACKFILL_EXECUTED=NO PROVIDER_CALLS=0 WORKER_STARTED=NO PREPROD_ACCESSED=NO'
