do $$ begin
  if not exists(select 1 from schema_migrations where version='0010_provider_discovery_completeness') then raise exception 'Migration 0010_provider_discovery_completeness must be applied first'; end if;
end $$;

alter table provider_championships add column current_window_days integer not null default 7 check(current_window_days between 1 and 90);
alter table provider_instances
  add column discovery_lease_owner text,
  add column discovery_lease_expires_at timestamptz,
  add column discovery_lease_generation bigint not null default 0 check(discovery_lease_generation >= 0);

create table scheduler_configuration (
  singleton boolean primary key default true check(singleton),
  global_worker_pool integer not null default 4 check(global_worker_pool between 1 and 64),
  lease_duration_seconds integer not null default 120 check(lease_duration_seconds between 30 and 3600),
  heartbeat_seconds integer not null default 30 check(heartbeat_seconds between 5 and 600 and heartbeat_seconds < lease_duration_seconds),
  weight_current integer not null default 3 check(weight_current > 0),
  weight_recent integer not null default 2 check(weight_recent > 0),
  weight_deep integer not null default 1 check(weight_deep > 0),
  sync_now_boost_minutes integer not null default 15 check(sync_now_boost_minutes between 1 and 1440),
  dispatch_counter bigint not null default 0 check(dispatch_counter >= 0),
  updated_at timestamptz not null default now()
);
insert into scheduler_configuration(singleton) values(true);

create table sync_streams (
  id uuid primary key,
  provider_championship_id uuid not null references provider_championships(id) on delete cascade,
  phase text not null check(phase in ('current','historical')),
  state text not null default 'ready' check(state in ('pending','ready','running','waiting_quota','backoff','paused','suspended','error','complete')),
  cursor_version integer not null check(cursor_version > 0),
  cursor jsonb not null default '{}'::jsonb check(jsonb_typeof(cursor)='object'),
  current_window_start date,
  current_window_year integer,
  historical_state jsonb not null default '{"recent_catchup_queue":[],"deep_history_year":null,"deep_history_cursor":{}}'::jsonb check(jsonb_typeof(historical_state)='object'),
  next_eligible_at timestamptz,
  priority_boost_until timestamptz,
  failure_count integer not null default 0 check(failure_count >= 0),
  last_error_code text,
  lease_owner text,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  lease_generation bigint not null default 0 check(lease_generation >= 0),
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_championship_id,phase),
  check((lease_owner is null and lease_acquired_at is null and lease_expires_at is null) or (lease_owner is not null and lease_acquired_at is not null and lease_expires_at is not null))
);
create index sync_streams_eligibility_idx on sync_streams(state,next_eligible_at,priority_boost_until desc);
create index sync_streams_lease_idx on sync_streams(lease_expires_at) where lease_owner is not null;

create table sync_runs (
  id uuid primary key,
  stream_id uuid not null references sync_streams(id) on delete cascade,
  worker_id text not null,
  lease_generation bigint not null,
  work_class text not null check(work_class in ('current','recent_catchup','deep_history','discovery')),
  cursor_before jsonb not null check(jsonb_typeof(cursor_before)='object'),
  cursor_after jsonb check(cursor_after is null or jsonb_typeof(cursor_after)='object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check(status in ('running','completed','failed_transient','failed_durable','interrupted','skipped_quota')),
  request_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index sync_runs_stream_history_idx on sync_runs(stream_id,started_at desc);
create unique index sync_runs_one_running_stream_idx on sync_runs(stream_id) where status='running';

insert into schema_migrations(version) values('0011_persistent_sync_scheduler') on conflict do nothing;
