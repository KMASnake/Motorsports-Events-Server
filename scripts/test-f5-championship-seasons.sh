#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="mse-f5-seasons-${RANDOM}-$$"
export POSTGRES_PORT=$((57000 + RANDOM % 2000))
export POSTGRES_PASSWORD="f5-seasons-local-test"
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

[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0033_f5_championship_seasons ]]
[[ "$(sql "select count(*) from championship_seasons")" == 0 ]]
[[ "$(sql "select count(*) from meetings where championship_season_id is not null")" == 0 ]]

sql "insert into championships(id,slug,name,season) values('f5-other','f5-other','F5 other',2026);
insert into championship_seasons(id,championship_id,key,label,start_year,end_year,starts_on,ends_on) values
('33000000-0000-4000-8000-000000000001','f1','2026','Formula 1 2026',2026,2026,'2026-01-01','2026-12-31'),
('33000000-0000-4000-8000-000000000002','f1','2026-special','Commercial edition',2026,2027,'2026-08-01','2027-05-31'),
('33000000-0000-4000-8000-000000000003','f5-other','2026','Other 2026',2026,2026,null,null);" >/dev/null

if sql "insert into championship_seasons(id,championship_id,key,label) values('33000000-0000-4000-8000-000000000004','f1','2026','Duplicate')" >/dev/null 2>&1; then
  echo 'duplicate scoped key accepted' >&2; exit 1
fi

# A populated registry must keep its complete schema and data after refusal.
if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0033_f5_championship_seasons >/dev/null 2>&1; then
  echo 'down accepted while registry contains data' >&2; exit 1
fi
[[ "$(sql "select to_regclass('public.championship_seasons')")" == championship_seasons ]]
[[ "$(sql "select count(*) from information_schema.columns where table_schema='public' and table_name='meetings' and column_name='championship_season_id'")" == 1 ]]
[[ "$(sql "select count(*) from pg_constraint where conname='meetings_championship_season_scope_fk'")" == 1 ]]
[[ "$(sql "select count(*) from championship_seasons")" == 3 ]]
[[ "$(sql "select count(*) from championship_seasons where id='33000000-0000-4000-8000-000000000001' and key='2026'")" == 1 ]]

sql "insert into meetings(id,championship_id,name,season,championship_season_id) values
('33000000-0000-4000-8000-000000000010','f1','Stable meeting',2026,'33000000-0000-4000-8000-000000000001');
insert into events(id,championship_id,name,slug,starts_at) values
('f5-season-event','f1','Stable event','f5-season-event','2026-01-01T00:00:00Z');
insert into meeting_events(meeting_id,event_id) values('33000000-0000-4000-8000-000000000010','f5-season-event');" >/dev/null

if sql "update meetings set championship_season_id='33000000-0000-4000-8000-000000000003' where id='33000000-0000-4000-8000-000000000010'" >/dev/null 2>&1; then
  echo 'cross-championship season link accepted' >&2; exit 1
fi
if sql "delete from championship_seasons where id='33000000-0000-4000-8000-000000000001'" >/dev/null 2>&1; then
  echo 'linked championship season delete accepted' >&2; exit 1
fi
[[ "$(sql "select count(*) from championship_seasons where id='33000000-0000-4000-8000-000000000001'")" == 1 ]]
[[ "$(sql "select count(*) from meetings where id='33000000-0000-4000-8000-000000000010' and championship_season_id='33000000-0000-4000-8000-000000000001'")" == 1 ]]

before="$(sql "select id||':'||championship_season_id from meetings where id='33000000-0000-4000-8000-000000000010'; select id from events where id='f5-season-event'")"
sql "update championship_seasons set label='Renamed',start_year=2025,end_year=2027,starts_on='2025-09-01',ends_on='2027-05-31' where id='33000000-0000-4000-8000-000000000001'" >/dev/null
[[ "$(sql "select id from championship_seasons where id='33000000-0000-4000-8000-000000000001' and label='Renamed'")" == 33000000-0000-4000-8000-000000000001 ]]
[[ "$(sql "select id||':'||championship_season_id from meetings where id='33000000-0000-4000-8000-000000000010'; select id from events where id='f5-season-event'")" == "${before}" ]]

if "${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0033_f5_championship_seasons >/dev/null 2>&1; then
  echo 'down accepted while a Meeting is linked' >&2; exit 1
fi
[[ "$(sql "select to_regclass('public.championship_seasons')")" == championship_seasons ]]
[[ "$(sql "select count(*) from information_schema.columns where table_schema='public' and table_name='meetings' and column_name='championship_season_id'")" == 1 ]]
[[ "$(sql "select count(*) from pg_constraint where conname='meetings_championship_season_scope_fk'")" == 1 ]]
[[ "$(sql "select count(*) from championship_seasons where id='33000000-0000-4000-8000-000000000001'")" == 1 ]]
[[ "$(sql "select count(*) from meetings where id='33000000-0000-4000-8000-000000000010' and championship_season_id='33000000-0000-4000-8000-000000000001'")" == 1 ]]
sql "update meetings set championship_season_id=null; delete from championship_seasons" >/dev/null
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh down 0033_f5_championship_seasons >/dev/null
[[ "$(sql "select to_regclass('public.championship_seasons') is null")" == t ]]
[[ "$(sql "select season from championships where id='f1'")" == 2026 ]]
[[ "$(sql "select season from meetings where id='33000000-0000-4000-8000-000000000010'")" == 2026 ]]
"${compose[@]}" run --rm migrate sh /migrations/migrate.sh up >/dev/null
[[ "$(sql "select version from schema_migrations order by version desc limit 1")" == 0033_f5_championship_seasons ]]

echo 'F5-2 fresh/upgrade/down/re-upgrade and identity constraints: PASS'
echo 'PROVIDER_CALLS=0 WORKER_STARTED=NO PREPROD_ACCESSED=NO'
