do $$
begin
  if not exists (
    select 1 from schema_migrations
    where version = '0007_provider_instances'
  ) then
    raise exception 'Migration 0007_provider_instances must be applied first';
  end if;
end $$;

create table if not exists provider_championships (
  id uuid primary key,
  provider_instance_id uuid not null
    references provider_instances(id) on delete cascade,
  championship_id text not null
    references championships(id) on delete restrict,
  external_championship_id text,
  discovery_state text not null default 'manual'
    check (discovery_state in ('manual','discovered','configured')),
  sync_state text not null default 'inactive'
    check (sync_state in ('inactive','active','paused','suspended','error')),
  is_primary boolean not null default false,
  start_year integer,
  discovered_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_championships_start_year_range
    check (start_year is null or start_year between 1900 and 2200),
  constraint provider_championships_active_primary
    check (sync_state <> 'active' or is_primary),
  unique(provider_instance_id, championship_id)
);

create unique index if not exists provider_championships_one_active_primary_idx
  on provider_championships(championship_id)
  where is_primary and sync_state = 'active';
create index if not exists provider_championships_provider_state_idx
  on provider_championships(provider_instance_id, sync_state);
create index if not exists provider_championships_championship_idx
  on provider_championships(championship_id);

create table if not exists provider_championship_source_configs (
  provider_championship_id uuid primary key
    references provider_championships(id) on delete cascade,
  schema_version integer not null check (schema_version > 0),
  config jsonb not null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_championship_source_configs_object
    check (jsonb_typeof(config) = 'object')
);

with legacy_providers as (
  select lower(btrim(provider_key)) as normalized_key,
         min(btrim(provider_key)) as original_key
  from championships
  where nullif(btrim(provider_key), '') is not null
  group by lower(btrim(provider_key))
)
insert into provider_instances(
  id, adapter_key, name, enabled, state, config
)
select
  md5('mse:legacy-provider:' || normalized_key)::uuid,
  'legacy-unresolved',
  'Legacy ' || original_key,
  false,
  'draft',
  jsonb_build_object('legacy_provider_key', original_key)
from legacy_providers
on conflict do nothing;

insert into provider_championships(
  id, provider_instance_id, championship_id, external_championship_id,
  discovery_state, sync_state, is_primary
)
select
  md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id)::uuid,
  md5('mse:legacy-provider:' || lower(btrim(c.provider_key)))::uuid,
  c.id,
  nullif(btrim(c.external_id), ''),
  'manual',
  'inactive',
  false
from championships c
where nullif(btrim(c.provider_key), '') is not null
on conflict do nothing;

insert into schema_migrations(version)
values ('0008_provider_championship_sources')
on conflict do nothing;
