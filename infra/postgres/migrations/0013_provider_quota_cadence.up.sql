do $$ begin
  if not exists(select 1 from schema_migrations where version='0012_scheduler_audit_fixes') then
    raise exception 'Migration 0012_scheduler_audit_fixes must be applied first';
  end if;
end $$;

alter table provider_instances
  alter column current_year_reserve_percent set default 20,
  drop constraint if exists provider_instances_current_year_reserve_percent_check;
update provider_instances set current_year_reserve_percent=least(50,current_year_reserve_percent);
alter table provider_instances
  add constraint provider_instances_current_year_reserve_percent_check
    check(current_year_reserve_percent between 0 and 50);

alter table provider_quota_policies
  add column minute_limit integer check(minute_limit is null or minute_limit > 0),
  add column hourly_limit integer check(hourly_limit is null or hourly_limit > 0),
  add column daily_limit integer check(daily_limit is null or daily_limit > 0),
  add column minimum_interval_seconds integer not null default 1 check(minimum_interval_seconds between 0 and 86400),
  add column safety_margin_percent numeric(5,2) not null default 5 check(safety_margin_percent between 0 and 20),
  add column current_reserve_mode text not null default 'percent' check(current_reserve_mode in ('percent','absolute')),
  add column current_reserve_value integer not null default 20 check(current_reserve_value >= 0),
  add column provider_timezone text not null default 'UTC',
  add constraint provider_quota_reserve_value_check check(
    (current_reserve_mode='percent' and current_reserve_value between 0 and 50)
    or (current_reserve_mode='absolute' and current_reserve_value >= 0)
  );

update provider_quota_policies
set minute_limit=case when short_window_seconds=60 then short_limit end,
    hourly_limit=case when short_window_seconds=3600 then short_limit end,
    current_reserve_value=least(50, greatest(0, round((select current_year_reserve_percent from provider_instances p where p.id=provider_instance_id))::int)),
    provider_timezone=coalesce(reset_timezone,'UTC');

create table provider_quota_windows (
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  window_kind text not null check(window_kind in ('minute','hour','day','month')),
  window_started_at timestamptz not null,
  consumed bigint not null default 0 check(consumed >= 0),
  updated_at timestamptz not null default now(),
  primary key(provider_instance_id,window_kind,window_started_at)
);

create table provider_quota_runtime (
  provider_instance_id uuid primary key references provider_instances(id) on delete cascade,
  last_request_at timestamptz,
  provider_backoff_until timestamptz,
  provider_failure_count integer not null default 0 check(provider_failure_count >= 0),
  last_blocking_reason text,
  updated_at timestamptz not null default now()
);

create table provider_quota_observations (
  id bigserial primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  observed_at timestamptz not null,
  window_kind text not null check(window_kind in ('minute','hour','day','month')),
  limit_value bigint check(limit_value is null or limit_value > 0),
  remaining bigint check(remaining is null or remaining >= 0),
  resets_at timestamptz,
  reliable boolean not null default false,
  created_at timestamptz not null default now()
);
create index provider_quota_observations_latest_idx
  on provider_quota_observations(provider_instance_id,window_kind,observed_at desc);

create table provider_request_charges (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  stream_id uuid references sync_streams(id) on delete set null,
  work_class text not null check(work_class in ('current','recent_catchup','deep_history','manual_discovery','periodic_discovery','connection_test')),
  charged_at timestamptz not null,
  emitted boolean,
  outcome text,
  created_at timestamptz not null default now()
);
create index provider_request_charges_provider_idx on provider_request_charges(provider_instance_id,charged_at desc);

alter table sync_streams
  add column stream_backoff_until timestamptz,
  add column stream_failure_count integer not null default 0 check(stream_failure_count >= 0);

insert into schema_migrations(version) values('0013_provider_quota_cadence') on conflict do nothing;
