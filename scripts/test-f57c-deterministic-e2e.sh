#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="mse-f57c-postgres-${RANDOM}-$$"
IMAGE="${F57C_POSTGRES_IMAGE:-postgres:17-alpine}"
cleanup(){ docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

test -z "${DATABASE_URL:-}" || { echo 'F5-7C refuses an inherited DATABASE_URL.' >&2; exit 1; }
# The certified F5-6 harness owns its required 0036 -> 0037 legacy-import
# transition. Running it first preserves that proof instead of skipping or
# recreating the imported legacy rows on an already-upgraded schema.
bash "${ROOT}/scripts/test-f5-multi-provider-reconciliation.sh"
docker run -d --name "${CONTAINER}" --label mse.certification=f57c --publish 127.0.0.1::5432 \
  --network bridge --read-only --tmpfs /var/run/postgresql --tmpfs /tmp \
  -e POSTGRES_DB=f57c -e POSTGRES_USER=mse -e POSTGRES_PASSWORD=f57c-local-only \
  -v "${ROOT}/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -v "${ROOT}/infra/postgres/migrations:/migrations:ro" "${IMAGE}" >/dev/null
for _ in $(seq 1 60);do docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" pg_isready -U mse -d f57c >/dev/null 2>&1&&break;sleep 1;done
docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" pg_isready -U mse -d f57c >/dev/null
PORT="$(docker port "${CONTAINER}" 5432/tcp | sed -n 's/^127\.0\.0\.1:\([0-9][0-9]*\)$/\1/p')"
[[ "${PORT}" =~ ^[0-9]+$ ]] || { echo 'F5-7C localhost-only PostgreSQL binding missing.' >&2; exit 1; }

docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d f57c"
  $psql -c "create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now())" >/dev/null
  for file in /migrations/*.up.sql;do $psql -1 -f "$file" >/dev/null; test "$(basename "$file")" != 0039_f5_confirmed_event_status.up.sql || break; done
  $psql -c "insert into championships(id,slug,name,season,active,sync_enabled) values (\$q\$f57c-migration\$q\$,\$q\$f57c-migration\$q\$,\$q\$F57C migration\$q\$,2026,true,false);insert into meetings(id,championship_id,name,season,timezone) values (\$q\$57c00000-0000-4000-8000-000000000040\$q\$,\$q\$f57c-migration\$q\$,\$q\$F57C migration meeting\$q\$,2026,\$q\$UTC\$q\$);insert into events(id,championship_id,name,slug,starts_at,timezone,status,published,origin,session_type_key) values (\$q\$f57c-migration-event\$q\$,\$q\$f57c-migration\$q\$,\$q\$F57C migration event\$q\$,\$q\$f57c-migration-event\$q\$,\$q\$2026-09-30T12:00:00Z\$q\$,\$q\$UTC\$q\$,\$q\$scheduled\$q\$,false,\$q\$manual\$q\$,\$q\$other\$q\$)" >/dev/null
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.up.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$meetings\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$events\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  test "$($psql -Atc "select timezone from meetings where id=\$q\$57c00000-0000-4000-8000-000000000040\$q\$")" = UTC
  test "$($psql -Atc "select timezone from events where id=\$q\$f57c-migration-event\$q\$")" = UTC
  $psql -c "delete from events where id=\$q\$f57c-migration-event\$q\$;delete from meetings where id=\$q\$57c00000-0000-4000-8000-000000000040\$q\$;delete from championships where id=\$q\$f57c-migration\$q\$" >/dev/null
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0039_f5_confirmed_event_status
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.up.sql >/dev/null
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null
  $psql -1 -f /migrations/0039_f5_confirmed_event_status.down.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0038_f5_canonical_publication
  $psql -1 -f /migrations/0039_f5_confirmed_event_status.up.sql >/dev/null
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.up.sql >/dev/null
'

export DATABASE_URL="postgresql://mse:f57c-local-only@127.0.0.1:${PORT}/f57c"
export RUN_F57C_POSTGRES=1
npm run test --workspace @mse/api -- --run tests/f57cEndToEnd.postgres.test.ts
# Clone the disposable certification database after the API pool has closed.
# This isolates the Event-only NULL DOWN proof from the other rollback tests.
docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" createdb -U mse -T f57c f57c_event_only
docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d f57c_event_only"
  $psql -c "update meetings set timezone=\$q\$UTC\$q\$ where timezone is null" >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
  test "$($psql -Atc "select count(*) from meetings where timezone is null")" = 0
  event_null_count="$($psql -Atc "select count(*) from events where timezone is null")"
  test "${event_null_count}" -ge 1
  meetings_before="$($psql -Atc "select id,timezone from meetings order by id")"
  events_before="$($psql -Atc "select id from events where timezone is null order by id")"
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$meetings\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$events\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  if $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null 2>&1;then
    echo "F5-7C Event-only NULL DOWN unexpectedly succeeded" >&2;exit 1
  fi
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
  test "$($psql -Atc "select id,timezone from meetings order by id")" = "${meetings_before}"
  test "$($psql -Atc "select id from events where timezone is null order by id")" = "${events_before}"
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$meetings\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$events\$q\$ and column_name=\$q\$timezone\$q\$")" = YES
  $psql -c "update events set timezone=\$q\$UTC\$q\$ where timezone is null" >/dev/null
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0039_f5_confirmed_event_status
  test "$($psql -Atc "select is_nullable from information_schema.columns where table_name=\$q\$events\$q\$ and column_name=\$q\$timezone\$q\$")" = NO
  $psql -1 -f /migrations/0040_f5_canonical_timezone_nullability.up.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
  echo "F57C_EVENT_ONLY_DOWN_EVIDENCE meetingNullBefore=0 eventNullBefore=${event_null_count} refused=PASS transactional=PASS eventDataUnchanged=PASS meetingDataUnchanged=PASS safeDown=PASS reupgrade=PASS"
'
if docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse -d f57c -1 -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null 2>&1;then
  echo 'F5-7C populated NULL-timezone DOWN unexpectedly succeeded' >&2;exit 1
fi
test "$(docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -At -U mse -d f57c -c "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
if docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse -d f57c -1 -c "update events set timezone='UTC' where timezone is null" -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null 2>&1;then
  echo 'F5-7C Meeting-NULL DOWN unexpectedly succeeded' >&2;exit 1
fi
if docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse -d f57c -1 -c "update meetings set timezone='UTC' where timezone is null" -f /migrations/0040_f5_canonical_timezone_nullability.down.sql >/dev/null 2>&1;then
  echo 'F5-7C Event-NULL DOWN unexpectedly succeeded' >&2;exit 1
fi
test "$(docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -At -U mse -d f57c -c "select count(*) from meetings where timezone is null")" -gt 0
test "$(docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -At -U mse -d f57c -c "select count(*) from events where timezone is null")" -gt 0
if docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse -d f57c -1 -c "update meetings set timezone='UTC' where timezone is null;update events set timezone='UTC' where timezone is null" -f /migrations/0040_f5_canonical_timezone_nullability.down.sql -f /migrations/0039_f5_confirmed_event_status.down.sql >/dev/null 2>&1;then
  echo 'F5-7C populated confirmed-status DOWN unexpectedly succeeded' >&2;exit 1
fi
test "$(docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -At -U mse -d f57c -c "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
echo 'F5-7C deterministic end-to-end certification: PASS'
