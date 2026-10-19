do $$ begin
  if not exists(select 1 from schema_migrations where version='0022_lot56_temporality_finalization') then
    raise exception 'Migration 0022_lot56_temporality_finalization must be applied first';
  end if;
end $$;

create table provider_source_corrections (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  field_path text not null check(field_path ~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'),
  override_value jsonb not null,
  source_value_at_creation jsonb,
  reason text check(reason is null or length(reason) <= 2000),
  origin text not null check(btrim(origin) <> '' and length(origin) <= 64),
  actor_id text not null check(btrim(actor_id) <> '' and length(actor_id) <= 256),
  status text not null default 'active' check(status in ('active','inactive')),
  revision bigint not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint provider_source_corrections_value_size check(octet_length(override_value::text) <= 65536),
  constraint provider_source_corrections_source_size check(source_value_at_creation is null or octet_length(source_value_at_creation::text) <= 65536),
  constraint provider_source_corrections_lifecycle_check check((status='active' and deactivated_at is null) or (status='inactive' and deactivated_at is not null))
);
create unique index provider_source_corrections_one_active_idx
  on provider_source_corrections(source_entity_id,field_path) where status='active';
create index provider_source_corrections_entity_idx
  on provider_source_corrections(source_entity_id,updated_at desc);

create table provider_source_local_observations (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  observation_key text not null check(observation_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$'),
  observation_kind text not null check(btrim(observation_kind) <> '' and length(observation_kind) <= 128),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  reason text check(reason is null or length(reason) <= 2000),
  origin text not null check(btrim(origin) <> '' and length(origin) <= 64),
  actor_id text not null check(btrim(actor_id) <> '' and length(actor_id) <= 256),
  revision bigint not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_source_local_observations_size check(octet_length(details::text) <= 65536),
  unique(source_entity_id,observation_key)
);
create index provider_source_local_observations_entity_idx
  on provider_source_local_observations(source_entity_id,updated_at desc);

insert into schema_migrations(version)
values('0023_lot56_source_protection') on conflict do nothing;
