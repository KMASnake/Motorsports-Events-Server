#!/bin/sh
set -eu
PROJECT=${LOT57PD_PROJECT:-mse-lot57pd-preview}
POSTGRES_PORT=${LOT57PD_POSTGRES_PORT:-55490}
PASSWORD=${LOT57PD_POSTGRES_PASSWORD:-lot57pd-preview-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@127.0.0.1:$POSTGRES_PORT/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at) values
('championship','57000000-0000-4000-8000-000000000300','f1',1,'active','{"resourceKind":"championship","name":"Formula 1","season":2026}',repeat('a',64),'2026-08-22T11:00:00Z'),
('event','57000000-0000-4000-8000-000000000301','f1',1,'active','{"resourceKind":"event","name":"Preview Race 1","sessionType":"race","sessionLabel":"Race","status":"scheduled","championshipId":"f1","circuitId":"circuit-1","startsAt":"2026-09-01T12:00:00Z","endsAt":null,"timezone":"UTC","presence":"seen"}',repeat('a',64),'2026-08-22T11:00:00Z'),
('event','57000000-0000-4000-8000-000000000302','f1',1,'active','{"resourceKind":"event","name":"Preview Race 2","sessionType":"race","sessionLabel":"Race","status":"scheduled","championshipId":"f1","circuitId":"circuit-1","startsAt":"2026-09-02T12:00:00Z","endsAt":null,"timezone":"UTC","presence":"seen"}',repeat('a',64),'2026-08-22T11:00:00Z');
insert into public_change_log(sequence,resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values
(1,'event','57000000-0000-4000-8000-000000000301',1,'created',array['name'],repeat('a',64),'2026-08-22T11:00:00Z'),
(2,'event','57000000-0000-4000-8000-000000000302',1,'created',array['name'],repeat('a',64),'2026-08-22T11:00:00Z');
select setval('public_change_sequence',2);
SQL
node scripts/validate-lot57pd-preview-api.mjs
