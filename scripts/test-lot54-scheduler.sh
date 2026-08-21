#!/bin/sh
set -eu
PROJECT=${LOT54_PROJECT:-mse-lot54-scheduler};POSTGRES_PORT=${LOT54_POSTGRES_PORT:-55474};PASSWORD=${LOT54_POSTGRES_PASSWORD:-lot54-scheduler-test};export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD" DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"
cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1||true; };trap cleanup EXIT INT TERM;cleanup
docker compose up -d --wait postgres >/dev/null;docker compose run --rm migrate >/dev/null;docker compose build api >/dev/null
docker compose run --rm -T -v "$PWD/scripts:/app/scripts:ro" api node scripts/validate-lot54.mjs
docker compose run --rm -T -v "$PWD/scripts:/app/scripts:ro" api node scripts/validate-lot54-audit.mjs
docker run --rm -v "$PWD:/source:ro" -w /work node:22-alpine sh -lc 'cp -a /source/. /work/ && npm ci >/dev/null && npm run typecheck --workspace @mse/api && npm test --workspace @mse/api -- schedulerPolicy.test.ts providerSchedulerRoutes.test.ts discoverySchedulerRuntime.test.ts'
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "do \$\$ begin if(select count(*) from schema_migrations where version in('0011_persistent_sync_scheduler','0012_scheduler_audit_fixes'))<>2 then raise exception 'migrations scheduler absentes';end if;if(select count(*) from sync_streams)<>0 or (select count(*) from sync_runs)<>0 then raise exception 'fixtures scheduler non nettoyées';end if;end \$\$;"
docker compose run --rm migrate sh /migrations/migrate.sh down 0024_lot57pa_normalized_persistence >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0023_lot56_source_protection >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0022_lot56_temporality_finalization >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0021_lot56_current_global_finalization_queue >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0020_lot56_current_refresh_scope >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0019_lot56_durable_orchestration >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0018_lot56_traversal_fencing >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0017_lot56_durable_parent_reference >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0016_lot56_durable_acquisition >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0015_lot55_final_audit_fixes >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0014_lot55_audit_fixes >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0013_provider_quota_cadence >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0012_scheduler_audit_fixes >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0011_persistent_sync_scheduler >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "select 'Rollback/réapplication 0011→0024 et données 5.3 conservées : OK' where to_regclass('public.provider_discovered_championships') is not null and to_regclass('public.sync_streams') is not null and to_regclass('public.provider_quota_runtime') is not null and to_regclass('public.normalization_checkpoints') is not null and exists(select 1 from information_schema.columns where table_name='provider_championships' and column_name='sync_state_before_championship_disable') and exists(select 1 from information_schema.columns where table_name='provider_instances' and column_name='discovery_next_eligible_at') and exists(select 1 from information_schema.columns where table_name='provider_quota_runtime' and column_name='next_eligible_at');"
echo 'Tests Lot 5.4 scheduler : OK'
