#!/bin/sh
set -eu
PROJECT=${LOT57PC_HISTORY_PROJECT:-mse-lot57pc-history}
POSTGRES_PORT=${LOT57PC_HISTORY_POSTGRES_PORT:-55491}
PASSWORD=${LOT57PC_HISTORY_POSTGRES_PASSWORD:-lot57pc-history-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
sql(){ docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"; }
trap cleanup EXIT INT TERM
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0027_lot57pc_public_resource_history >/dev/null
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at) values
('event','57000000-0000-4000-8000-000000000401','f1',1,'active','{"resourceKind":"event","name":"Baseline with log"}',repeat('a',64),'2026-08-22T10:00:00Z'),
('event','57000000-0000-4000-8000-000000000402','f1',1,'active','{"resourceKind":"event","name":"Baseline without log"}',repeat('b',64),'2026-08-22T10:01:00Z');
insert into public_change_log(sequence,resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at)
values(20,'event','57000000-0000-4000-8000-000000000401',1,'created',array['name'],repeat('a',64),'2026-08-22T10:00:00Z');
select setval('public_change_sequence',20);
SQL
counts_query="select (select count(*) from public_resource_states) || ':' || (select count(*) from public_change_log)"
before=$(sql "$counts_query")
docker compose run --rm migrate >/dev/null
[ "$(sql 'select count(*) from public_resource_versions')" = 2 ]
[ "$(sql 'select oldest_snapshot_sequence from public_history_controls')" = 21 ]
[ "$(sql 'select oldest_change_sequence from public_history_controls')" = 21 ]
[ "$(sql "select count(*) from public_resource_versions where canonical_state::text ~ 'provider|credential|provenance|lease|stack|secret'")" = 0 ]
docker compose run --rm migrate sh /migrations/migrate.sh down 0027_lot57pc_public_resource_history >/dev/null
[ "$before" = "$(sql "$counts_query")" ]
docker compose run --rm migrate >/dev/null
[ "$(sql 'select count(*) from public_resource_versions')" = 2 ]
[ "$(sql "select count(*) from schema_migrations where version='0027_lot57pc_public_resource_history'")" = 1 ]
echo '0027 fresh/upgrade/down/up and baseline boundary: PASS'
