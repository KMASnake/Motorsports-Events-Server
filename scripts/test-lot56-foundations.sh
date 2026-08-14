#!/bin/sh
set -eu

PROJECT=${LOT56_PROJECT:-mse-lot56-foundations}
POSTGRES_PORT=${LOT56_POSTGRES_PORT:-55476}
PASSWORD=${LOT56_POSTGRES_PASSWORD:-lot56-foundations-test}
export COMPOSE_PROJECT_NAME="$PROJECT" POSTGRES_PORT POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup(){ docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

echo 'Démarrage de la base PostgreSQL jetable Lot 5.6-A...'
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 <<'SQL'
select 'Migration 0016 appliquée : OK'
where exists(select 1 from schema_migrations where version='0016_lot56_durable_acquisition');

insert into provider_instances(id,adapter_key,name,enabled,state)
values('56000000-0000-0000-0000-000000000001','lot56-fixture','Lot 5.6 Fixture',true,'active');
insert into provider_championships(
  id,provider_instance_id,championship_id,external_championship_id,
  discovery_state,sync_state,is_primary
) values(
  '56000000-0000-0000-0000-000000000002',
  '56000000-0000-0000-0000-000000000001','f1','fixture-f1',
  'configured','active',true
);
insert into provider_source_entities(
  id,provider_instance_id,provider_championship_id,entity_kind,external_id,
  source_data,source_hash,provider_started_at,provider_ended_at,
  first_observed_at,last_observed_at,last_changed_at
) values(
  '56000000-0000-0000-0000-000000000003',
  '56000000-0000-0000-0000-000000000001',
  '56000000-0000-0000-0000-000000000002',
  'session','pre-1970-fixture',
  '{"name":"Historic Grand Prix"}', 'fixture-hash',
  '1950-05-13T12:00:00+01:00','1950-05-13T14:00:00+01:00',
  now(),now(),now()
);

select 'Pré-1970 et unicité source : OK'
where (select provider_started_at='1950-05-13T11:00:00Z'::timestamptz
       from provider_source_entities where external_id='pre-1970-fixture')
  and exists(
    select 1 from pg_constraint
    where conrelid='provider_source_entities'::regclass and contype='u'
  );
SQL

if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  insert into provider_source_entities(
    id,provider_instance_id,provider_championship_id,entity_kind,external_id,
    source_data,source_hash,first_observed_at,last_observed_at,last_changed_at
  ) values(
    '56000000-0000-0000-0000-000000000004',
    '56000000-0000-0000-0000-000000000001',
    '56000000-0000-0000-0000-000000000002',
    'session','pre-1970-fixture','{}','duplicate',now(),now(),now()
  );" >/dev/null 2>&1; then
  echo 'Le doublon source aurait dû être refusé.' >&2
  exit 1
fi
echo 'Doublon source refusé : OK'

if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  insert into provider_source_entities(
    id,provider_instance_id,provider_championship_id,entity_kind,external_id,
    source_data,source_hash,first_observed_at,last_observed_at,last_changed_at
  ) values(
    '56000000-0000-0000-0000-000000000005',
    '56000000-0000-0000-0000-000000000001',
    '56000000-0000-0000-0000-000000000002',
    'session','oversized-fixture',jsonb_build_object('payload',repeat('x',262144)),
    'oversized',now(),now(),now()
  );" >/dev/null 2>&1; then
  echo 'La donnée source surdimensionnée aurait dû être refusée.' >&2
  exit 1
fi
echo 'Donnée source surdimensionnée refusée en base : OK'

if docker compose run --rm migrate sh /migrations/migrate.sh down 0016_lot56_durable_acquisition >/dev/null 2>&1; then
  echo 'Le down destructif aurait dû être refusé.' >&2
  exit 1
fi
echo 'Down destructif refusé par défaut : OK'

docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c 'truncate provider_source_entities cascade; truncate provider_acquisition_traversals cascade;'
docker compose run --rm migrate sh /migrations/migrate.sh down 0016_lot56_durable_acquisition >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "select 'Cycle up/down/up sur base jetable : OK' where exists(select 1 from schema_migrations where version='0016_lot56_durable_acquisition');"

docker run --rm \
  -v "$PWD":/source:ro \
  -w /tmp/project \
  node:22-alpine \
  sh -lc 'cp -a /source/. . && npm ci >/dev/null && npm test --workspace @mse/api -- providerSourceStorage.test.ts'

echo 'Tests Lot 5.6-A fondations de persistance : OK'
