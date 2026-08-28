#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
PROJECT="${LOT57PF3_PROJECT:-mse-lot57pf3-certification}"
POSTGRES_PORT="${LOT57PF3_POSTGRES_PORT:-55493}"
PASSWORD="${LOT57PF3_POSTGRES_PASSWORD:-lot57pf3-certification-test}"
export COMPOSE_PROJECT_NAME="${PROJECT}" POSTGRES_PORT POSTGRES_PASSWORD="${PASSWORD}"
export DATABASE_URL="postgresql://mse:${PASSWORD}@127.0.0.1:${POSTGRES_PORT}/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
npm run build --workspace @mse/api >/dev/null
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events <<'SQL' >/dev/null
insert into provider_instances(id,adapter_key,name,enabled,state)
values('57000000-0000-4000-8000-00000000f301','f3-fixture','F3 isolated certification fixture',true,'active');
insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary)
values('57000000-0000-4000-8000-00000000f302','57000000-0000-4000-8000-00000000f301','f1','fixture-f1','configured','active',true);
insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor)
values('57000000-0000-4000-8000-00000000f303','57000000-0000-4000-8000-00000000f302','current','ready',1,'{}');
insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by)
values('57000000-0000-4000-8000-00000000f304','57000000-0000-4000-8000-00000000f302','f3-v1','f3-rules-v1',
  '{"championshipIds":{"fixture-f1":"f1"},"circuitIds":{"silverstone":"silverstone"},"sessionTypes":{"Race":"race","Qualifying":"qualifying"},"statuses":{"Scheduled":"scheduled"}}','f3-certification');
insert into provider_championship_active_normalization_mappings(provider_championship_id,mapping_version_id,activated_at,activated_by)
values('57000000-0000-4000-8000-00000000f302','57000000-0000-4000-8000-00000000f304','2026-08-28T12:00:00Z','f3-certification');
SQL

node scripts/validate-lot57pf3-operational-closure.mjs
echo 'F3 deterministic operational closure certification: PASS'
echo 'PROVIDER_CALLS=0'
echo 'PROVIDER_CREDITS=0'
echo 'WORKER_STARTED=NO'
