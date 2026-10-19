do $$ begin
  if not exists (select 1 from schema_migrations where version='0008_provider_championship_sources') then
    raise exception 'Migration 0008_provider_championship_sources must be applied first';
  end if;
end $$;

alter table provider_instances
  add column discovery_enabled boolean not null default false,
  add column discovery_interval_days integer not null default 30 check(discovery_interval_days >= 7),
  add column last_discovery_at timestamptz;

create table provider_discovered_championships (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  external_championship_id text not null check(btrim(external_championship_id) <> ''),
  name text not null check(btrim(name) <> ''),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  proposed_source_config jsonb not null check(jsonb_typeof(proposed_source_config)='object'),
  proposed_source_config_version integer not null check(proposed_source_config_version > 0),
  proposed_source_config_hash text not null,
  first_discovered_at timestamptz not null default now(),
  last_discovered_at timestamptz not null default now(),
  missing_complete_cycles integer not null default 0 check(missing_complete_cycles >= 0),
  state text not null default 'needs_association' check(state in ('needs_association','associated','not_found')),
  provider_championship_id uuid references provider_championships(id) on delete set null,
  source_config_diverged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_instance_id, external_championship_id)
);
create index provider_discovered_championships_state_idx
  on provider_discovered_championships(provider_instance_id,state,last_discovered_at desc);

create table provider_discovery_runs (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  origin text not null check(origin in ('manual','periodic')),
  status text not null check(status in ('running','completed','partial','failed','deferred_quota')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer check(duration_ms is null or duration_ms >= 0),
  request_count integer not null default 0 check(request_count >= 0),
  found_count integer not null default 0 check(found_count >= 0),
  new_count integer not null default 0 check(new_count >= 0),
  not_found_count integer not null default 0 check(not_found_count >= 0),
  divergence_count integer not null default 0 check(divergence_count >= 0),
  error_code text,
  error_message text,
  deferred_reason text,
  request_id text,
  created_at timestamptz not null default now()
);
create index provider_discovery_runs_history_idx
  on provider_discovery_runs(provider_instance_id,started_at desc);

insert into schema_migrations(version) values('0009_provider_discovery') on conflict do nothing;
