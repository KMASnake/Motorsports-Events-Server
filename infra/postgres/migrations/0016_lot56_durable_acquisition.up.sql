do $$ begin
  if not exists(select 1 from schema_migrations where version='0015_lot55_final_audit_fixes') then
    raise exception 'Migration 0015_lot55_final_audit_fixes must be applied first';
  end if;
end $$;

alter table provider_championships
  add column acquisition_history_mode text not null default 'all'
    check(acquisition_history_mode in ('all','from_season','none')),
  add column acquisition_history_from_season integer,
  add column acquisition_empty_season_limit integer not null default 5
    check(acquisition_empty_season_limit between 1 and 100),
  add column acquisition_current_hot_days integer not null default 30
    check(acquisition_current_hot_days between 1 and 366),
  add column acquisition_finalization_grace_days integer not null default 30
    check(acquisition_finalization_grace_days between 1 and 366),
  add constraint provider_championships_history_mode_start_check check(
    (acquisition_history_mode='from_season' and acquisition_history_from_season is not null)
    or (acquisition_history_mode<>'from_season' and acquisition_history_from_season is null)
  ),
  add constraint provider_championships_id_provider_unique unique(id,provider_instance_id);

create table provider_acquisition_state (
  provider_championship_id uuid primary key references provider_championships(id) on delete cascade,
  bootstrap_state text not null default 'pending'
    check(bootstrap_state in ('pending','current','recent_catchup','deep_history','complete')),
  recent_catchup_state text not null default 'pending'
    check(recent_catchup_state in ('pending','running','complete','disabled')),
  deep_history_state text not null default 'pending'
    check(deep_history_state in ('pending','running','complete','disabled')),
  deep_history_season integer,
  consecutive_empty_seasons integer not null default 0 check(consecutive_empty_seasons >= 0),
  current_last_future_at timestamptz,
  current_last_complete_at timestamptz,
  last_progressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table provider_acquisition_traversals (
  id uuid primary key,
  stream_id uuid not null references sync_streams(id) on delete cascade,
  run_id uuid references sync_runs(id) on delete set null,
  work_class text not null
    check(work_class in ('current_hot','current_future','finalization','recent_catchup','deep_history')),
  season integer,
  safe_unit_key text not null check(btrim(safe_unit_key) <> ''),
  status text not null default 'running'
    check(status in ('running','complete','partial','failed','empty_confirmed')),
  complete boolean not null default false,
  received_items integer not null default 0 check(received_items >= 0),
  valid_items integer not null default 0 check(valid_items >= 0),
  anomaly_items integer not null default 0 check(anomaly_items >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_acquisition_traversal_completion_check check(
    (complete and status in ('complete','empty_confirmed') and finished_at is not null)
    or (not complete and status not in ('complete','empty_confirmed'))
  )
);
create index provider_acquisition_traversals_stream_idx
  on provider_acquisition_traversals(stream_id,started_at desc);

create table provider_source_entities (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  provider_championship_id uuid not null,
  entity_kind text not null check(btrim(entity_kind) <> '' and length(entity_kind) <= 64),
  external_id text not null check(btrim(external_id) <> '' and length(external_id) <= 512),
  identity_is_synthetic boolean not null default false,
  parent_source_entity_id uuid,
  season integer,
  source_data jsonb not null check(jsonb_typeof(source_data)='object'),
  source_hash text not null check(btrim(source_hash) <> '' and length(source_hash) <= 256),
  source_status text,
  provider_started_at timestamptz,
  provider_ended_at timestamptz,
  theoretical_end_at timestamptz,
  end_estimated boolean not null default false,
  end_provenance text check(end_provenance is null or end_provenance in (
    'provider','last_known_session','provider_peer_duration','adapter_rule','civil_day_fallback'
  )),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  last_changed_at timestamptz not null,
  last_traversal_id uuid references provider_acquisition_traversals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_source_entities_size_check check(octet_length(source_data::text) <= 262144),
  constraint provider_source_entities_dates_check check(
    provider_ended_at is null or provider_started_at is null or provider_ended_at >= provider_started_at
  ),
  constraint provider_source_entities_observation_check check(last_observed_at >= first_observed_at),
  constraint provider_source_entities_estimation_check check(
    (not end_estimated and (end_provenance is null or end_provenance='provider'))
    or (end_estimated and end_provenance is not null and end_provenance<>'provider')
  ),
  constraint provider_source_entities_provider_scope_fk
    foreign key(provider_championship_id,provider_instance_id)
    references provider_championships(id,provider_instance_id) on delete cascade,
  unique(id,provider_instance_id,provider_championship_id),
  constraint provider_source_entities_parent_scope_fk
    foreign key(parent_source_entity_id,provider_instance_id,provider_championship_id)
    references provider_source_entities(id,provider_instance_id,provider_championship_id)
    on delete set null (parent_source_entity_id),
  unique(provider_championship_id,entity_kind,external_id)
);
create index provider_source_entities_provider_idx
  on provider_source_entities(provider_instance_id,provider_championship_id,entity_kind);
create index provider_source_entities_temporal_idx
  on provider_source_entities(provider_championship_id,provider_started_at);

create table provider_source_observations (
  traversal_id uuid not null references provider_acquisition_traversals(id) on delete cascade,
  source_entity_id uuid not null references provider_source_entities(id) on delete cascade,
  observation_kind text not null check(observation_kind in ('present','not_observed')),
  observed_at timestamptz not null,
  primary key(traversal_id,source_entity_id)
);

create function enforce_provider_source_observation_scope()
returns trigger language plpgsql as $$
declare
  traversal_complete boolean;
  traversal_championship_id uuid;
  entity_championship_id uuid;
begin
  select t.complete,s.provider_championship_id
    into traversal_complete,traversal_championship_id
    from provider_acquisition_traversals t
    join sync_streams s on s.id=t.stream_id
    where t.id=new.traversal_id;
  select provider_championship_id into entity_championship_id
    from provider_source_entities where id=new.source_entity_id;
  if traversal_championship_id is distinct from entity_championship_id then
    raise exception 'Observation and source entity must share the same provider championship scope';
  end if;
  if new.observation_kind='not_observed' and traversal_complete is not true then
    raise exception 'Non-observation requires a complete traversal';
  end if;
  return new;
end $$;

create trigger provider_source_observations_scope_guard
before insert or update on provider_source_observations
for each row execute function enforce_provider_source_observation_scope();

create table provider_source_changes (
  id bigserial primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete cascade,
  traversal_id uuid references provider_acquisition_traversals(id) on delete set null,
  change_type text not null check(btrim(change_type) <> ''),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  origin text not null check(origin in ('provider','admin')),
  manual_override_active boolean not null default false,
  changed_at timestamptz not null default now(),
  constraint provider_source_changes_old_size_check check(old_value is null or octet_length(old_value::text) <= 65536),
  constraint provider_source_changes_new_size_check check(new_value is null or octet_length(new_value::text) <= 65536)
);
create index provider_source_changes_entity_idx
  on provider_source_changes(source_entity_id,changed_at desc);

create table provider_acquisition_anomalies (
  id uuid primary key,
  provider_championship_id uuid not null references provider_championships(id) on delete cascade,
  source_entity_id uuid references provider_source_entities(id) on delete cascade,
  anomaly_key text not null check(btrim(anomaly_key) <> '' and length(anomaly_key) <= 512),
  anomaly_type text not null check(btrim(anomaly_type) <> '' and length(anomaly_type) <= 128),
  scope text not null check(scope in ('entity','stream','provider')),
  state text not null default 'active' check(state in ('active','resolved')),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrence_count bigint not null default 1 check(occurrence_count > 0),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_acquisition_anomalies_size_check check(octet_length(details::text) <= 65536),
  constraint provider_acquisition_anomalies_dates_check check(last_seen_at >= first_seen_at),
  constraint provider_acquisition_anomalies_resolution_check check(
    (state='active' and resolved_at is null) or (state='resolved' and resolved_at is not null)
  )
);
create unique index provider_acquisition_anomalies_one_active_key_idx
  on provider_acquisition_anomalies(provider_championship_id,anomaly_key)
  where state='active';
create index provider_acquisition_anomalies_active_idx
  on provider_acquisition_anomalies(provider_championship_id,anomaly_type,last_seen_at desc)
  where state='active';

insert into schema_migrations(version)
values('0016_lot56_durable_acquisition') on conflict do nothing;
