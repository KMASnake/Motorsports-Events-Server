do $$
begin
  if not exists (
    select 1 from schema_migrations
    where version = '0006_admin_console_authentication'
  ) then
    raise exception 'Migration 0006_admin_console_authentication must be applied first';
  end if;
end $$;

create table if not exists provider_instances (
  id uuid primary key,
  adapter_key text not null,
  name text not null,
  enabled boolean not null default false,
  state text not null default 'draft'
    check (state in ('draft','active','paused','suspended','error')),
  config jsonb not null default '{}'::jsonb,
  max_concurrency integer not null default 1
    check (max_concurrency > 0),
  current_year_reserve_percent numeric(5,2) not null default 30
    check (current_year_reserve_percent between 0 and 100),
  missing_cycles_threshold integer not null default 3
    check (missing_cycles_threshold > 0),
  log_retention_days integer not null default 30
    check (log_retention_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_instances_adapter_key_not_blank check (btrim(adapter_key) <> ''),
  constraint provider_instances_name_not_blank check (btrim(name) <> ''),
  constraint provider_instances_config_object check (jsonb_typeof(config) = 'object'),
  constraint provider_instances_active_enabled check (state <> 'active' or enabled)
);

create unique index if not exists provider_instances_name_unique
  on provider_instances(lower(name));
create index if not exists provider_instances_state_enabled_idx
  on provider_instances(state, enabled);

create table if not exists provider_secrets (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  secret_name text not null check (btrim(secret_name) <> ''),
  ciphertext bytea not null,
  nonce bytea not null,
  key_version integer not null check (key_version > 0),
  algorithm text not null default 'aes-256-gcm' check (algorithm = 'aes-256-gcm'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_instance_id, secret_name),
  unique(key_version, nonce)
);
create index if not exists provider_secrets_provider_idx on provider_secrets(provider_instance_id);

create table if not exists provider_quota_policies (
  provider_instance_id uuid primary key references provider_instances(id) on delete cascade,
  short_window_seconds integer check (short_window_seconds is null or short_window_seconds > 0),
  short_limit integer check (short_limit is null or short_limit > 0),
  monthly_limit integer check (monthly_limit is null or monthly_limit > 0),
  limits_source text not null default 'configured'
    check (limits_source in ('configured','provider_headers','hybrid')),
  reset_timezone text,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((short_window_seconds is null) = (short_limit is null))
);

create table if not exists provider_quota_state (
  provider_instance_id uuid primary key references provider_instances(id) on delete cascade,
  internally_consumed_short bigint not null default 0 check (internally_consumed_short >= 0),
  internally_consumed_monthly bigint not null default 0 check (internally_consumed_monthly >= 0),
  observed_consumed_short bigint check (observed_consumed_short is null or observed_consumed_short >= 0),
  observed_consumed_monthly bigint check (observed_consumed_monthly is null or observed_consumed_monthly >= 0),
  observed_remaining_short bigint check (observed_remaining_short is null or observed_remaining_short >= 0),
  observed_remaining_monthly bigint check (observed_remaining_monthly is null or observed_remaining_monthly >= 0),
  observed_short_reset_at timestamptz,
  observed_monthly_reset_at timestamptz,
  last_observed_at timestamptz,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into schema_migrations(version)
values ('0007_provider_instances')
on conflict do nothing;
