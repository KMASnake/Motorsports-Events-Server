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
insert into provider_instances(id,adapter_key,name,enabled,state)
values('56000000-0000-0000-0000-000000000010','lot56-other','Lot 5.6 Other',true,'active');
insert into provider_championships(
  id,provider_instance_id,championship_id,external_championship_id,
  discovery_state,sync_state,is_primary
) values(
  '56000000-0000-0000-0000-000000000002',
  '56000000-0000-0000-0000-000000000001','f1','fixture-f1',
  'configured','active',true
);
insert into provider_championships(
  id,provider_instance_id,championship_id,external_championship_id,
  discovery_state,sync_state,is_primary
) values(
  '56000000-0000-0000-0000-000000000011',
  '56000000-0000-0000-0000-000000000010','motogp','fixture-motogp',
  'configured','active',true
);
insert into sync_streams(
  id,provider_championship_id,phase,state,cursor_version,cursor
) values(
  '56000000-0000-0000-0000-000000000020',
  '56000000-0000-0000-0000-000000000002','current','ready',1,'{}'
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
insert into provider_source_entities(
  id,provider_instance_id,provider_championship_id,entity_kind,external_id,
  source_data,source_hash,provider_started_at,
  first_observed_at,last_observed_at,last_changed_at
) values
  ('56000000-0000-0000-0000-000000000006','56000000-0000-0000-0000-000000000001',
   '56000000-0000-0000-0000-000000000002','session','1969-fixture','{}','1969',
   '1969-12-31T23:30:00-01:00',now(),now(),now()),
  ('56000000-0000-0000-0000-000000000007','56000000-0000-0000-0000-000000000001',
   '56000000-0000-0000-0000-000000000002','meeting','1900-fixture','{}','1900',
   '1900-01-01T00:00:00Z',now(),now(),now()),
  ('56000000-0000-0000-0000-000000000012','56000000-0000-0000-0000-000000000010',
   '56000000-0000-0000-0000-000000000011','meeting','other-parent','{}','other',
   '2026-01-01T00:00:00Z',now(),now(),now());

insert into provider_acquisition_traversals(
  id,stream_id,lease_generation,work_class,safe_unit_key,status,complete,finished_at
) values
  ('56000000-0000-0000-0000-000000000021','56000000-0000-0000-0000-000000000020',
   1,'current_future','complete-page','complete',true,now()),
  ('56000000-0000-0000-0000-000000000022','56000000-0000-0000-0000-000000000020',
   1,'current_future','partial-page','partial',false,null);

insert into provider_source_observations(traversal_id,source_entity_id,observation_kind,observed_at)
values
  ('56000000-0000-0000-0000-000000000022','56000000-0000-0000-0000-000000000003','present',now()),
  ('56000000-0000-0000-0000-000000000021','56000000-0000-0000-0000-000000000006','not_observed',now());

insert into provider_acquisition_anomalies(
  id,provider_championship_id,anomaly_key,anomaly_type,scope,state,
  first_seen_at,last_seen_at
) values(
  '56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000002',
  'cycle-key','invalid_date','entity','active',now(),now()
);
update provider_acquisition_anomalies set state='resolved',resolved_at=now()
where id='56000000-0000-0000-0000-000000000030';
insert into provider_acquisition_anomalies(
  id,provider_championship_id,anomaly_key,anomaly_type,scope,state,
  first_seen_at,last_seen_at
) values(
  '56000000-0000-0000-0000-000000000031','56000000-0000-0000-0000-000000000002',
  'cycle-key','invalid_date','entity','active',now(),now()
);
update provider_acquisition_anomalies set state='resolved',resolved_at=now()
where id='56000000-0000-0000-0000-000000000031';
insert into provider_acquisition_anomalies(
  id,provider_championship_id,anomaly_key,anomaly_type,scope,state,
  first_seen_at,last_seen_at
) values(
  '56000000-0000-0000-0000-000000000032','56000000-0000-0000-0000-000000000002',
  'cycle-key','invalid_date','entity','active',now(),now()
);

select 'Dates 1950, 1969 et 1900 : OK'
where (select provider_started_at='1950-05-13T11:00:00Z'::timestamptz
       from provider_source_entities where external_id='pre-1970-fixture')
  and (select provider_started_at='1970-01-01T00:30:00Z'::timestamptz
       from provider_source_entities where external_id='1969-fixture')
  and (select provider_started_at='1900-01-01T00:00:00Z'::timestamptz
       from provider_source_entities where external_id='1900-fixture');

select 'Présence et non-observation durable : OK'
where (select count(*)=1 from provider_source_observations where observation_kind='present')
  and (select count(*)=1 from provider_source_observations where observation_kind='not_observed');

select 'Deux cycles anomalie puis nouvelle occurrence active : OK'
where (select count(*)=2 from provider_acquisition_anomalies
       where anomaly_key='cycle-key' and state='resolved')
  and (select count(*)=1 from provider_acquisition_anomalies
       where anomaly_key='cycle-key' and state='active');
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
    '56000000-0000-0000-0000-000000000013',
    '56000000-0000-0000-0000-000000000001',
    '56000000-0000-0000-0000-000000000011',
    'session','wrong-provider','{}','wrong-provider',now(),now(),now()
  );" >/dev/null 2>&1; then
  echo 'L incohérence provider/championnat aurait dû être refusée.' >&2
  exit 1
fi
echo 'Incohérence provider/championnat refusée : OK'

if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  insert into provider_source_entities(
    id,provider_instance_id,provider_championship_id,parent_source_entity_id,
    entity_kind,external_id,source_data,source_hash,
    first_observed_at,last_observed_at,last_changed_at
  ) values(
    '56000000-0000-0000-0000-000000000014',
    '56000000-0000-0000-0000-000000000001',
    '56000000-0000-0000-0000-000000000002',
    '56000000-0000-0000-0000-000000000012',
    'session','cross-scope-child','{}','cross-scope',now(),now(),now()
  );" >/dev/null 2>&1; then
  echo 'La relation parent hors périmètre aurait dû être refusée.' >&2
  exit 1
fi
echo 'Relation parent hors périmètre refusée : OK'

if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  insert into provider_source_observations(
    traversal_id,source_entity_id,observation_kind,observed_at
  ) values(
    '56000000-0000-0000-0000-000000000022',
    '56000000-0000-0000-0000-000000000007','not_observed',now()
  );" >/dev/null 2>&1; then
  echo 'La non-observation après traversal partiel aurait dû être refusée.' >&2
  exit 1
fi
echo 'Non-observation après traversal partiel refusée : OK'

docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  update provider_acquisition_traversals
  set complete=true,status='complete',finished_at=now()
  where id='56000000-0000-0000-0000-000000000022';
  insert into provider_source_observations(
    traversal_id,source_entity_id,observation_kind,observed_at
  ) values(
    '56000000-0000-0000-0000-000000000022',
    '56000000-0000-0000-0000-000000000007','not_observed',now()
  );
  select 'Traversal incomplet devenu complet : OK'
  where (select complete and status='complete'
         from provider_acquisition_traversals
         where id='56000000-0000-0000-0000-000000000022');"

if docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  update provider_acquisition_traversals
  set complete=false,status='partial',finished_at=null
  where id='56000000-0000-0000-0000-000000000021';" >/dev/null 2>&1; then
  echo 'La régression d un traversal complet aurait dû être refusée.' >&2
  exit 1
fi
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 -c "
  select 'Complétude historique immuable et non-observation préservée : OK'
  where (select complete and status='complete'
         from provider_acquisition_traversals
         where id='56000000-0000-0000-0000-000000000021')
    and exists(
      select 1 from provider_source_observations
      where traversal_id='56000000-0000-0000-0000-000000000021'
        and observation_kind='not_observed'
    );"

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
  -c 'truncate provider_acquisition_anomalies, provider_source_entities, provider_acquisition_traversals cascade;'
docker compose run --rm migrate sh /migrations/migrate.sh down 0027_lot57pc_public_resource_history >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0025_lot57pc_publication_state >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0024_lot57pa_normalized_persistence >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0023_lot56_source_protection >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0022_lot56_temporality_finalization >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0021_lot56_current_global_finalization_queue >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0020_lot56_current_refresh_scope >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0019_lot56_durable_orchestration >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0018_lot56_traversal_fencing >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0017_lot56_durable_parent_reference >/dev/null
docker compose run --rm migrate sh /migrations/migrate.sh down 0016_lot56_durable_acquisition >/dev/null
docker compose run --rm migrate >/dev/null
docker compose exec -T postgres psql -U mse -d motorsports_events -v ON_ERROR_STOP=1 \
  -c "do \$\$ begin
    if (select count(*) from schema_migrations where version in (
      '0016_lot56_durable_acquisition',
      '0017_lot56_durable_parent_reference',
      '0018_lot56_traversal_fencing',
      '0019_lot56_durable_orchestration',
      '0020_lot56_current_refresh_scope',
      '0021_lot56_current_global_finalization_queue',
      '0022_lot56_temporality_finalization',
      '0023_lot56_source_protection',
      '0024_lot57pa_normalized_persistence'
    )) <> 9 then raise exception 'Chaîne de migrations 0016→0024 incomplète après réapplication'; end if;
    if to_regclass('public.provider_source_entities') is null
       or to_regclass('public.provider_source_corrections') is null
       or to_regclass('public.provider_source_local_observations') is null then
      raise exception 'Schéma Lot 5.6 incomplet après réapplication';
    end if;
  end \$\$; select 'Cycle 0016→0024 up/down/up sur base jetable : OK';"

docker run --rm \
  -v "$PWD":/source:ro \
  -w /tmp/project \
  node:22-alpine \
  sh -lc 'cp -a /source/. . && npm ci >/dev/null && npm test --workspace @mse/api -- providerSourceStorage.test.ts'

echo 'Tests Lot 5.6-A fondations de persistance : OK'
