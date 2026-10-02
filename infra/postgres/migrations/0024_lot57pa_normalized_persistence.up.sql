do $$ begin
  if not exists(select 1 from schema_migrations where version='0023_lot56_source_protection') then
    raise exception 'Migration 0023_lot56_source_protection must be applied first';
  end if;
end $$;

alter table events
  add column normalized_uuid uuid,
  add column normalized_lifecycle text not null default 'active'
    check(normalized_lifecycle in ('active','removed')),
  add constraint events_normalized_uuid_unique unique(normalized_uuid),
  add constraint events_removed_identity_check check(
    normalized_lifecycle='active' or normalized_uuid is not null
  ),
  add constraint events_id_normalized_uuid_unique unique(id,normalized_uuid);

create table meetings (
  id uuid primary key,
  championship_id text not null references championships(id) on delete restrict,
  name text not null check(btrim(name)<>'' and length(name)<=512),
  season integer not null,
  round text check(round is null or length(round)<=128),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'UTC' check(btrim(timezone)<>'' and length(timezone)<=128),
  lifecycle text not null default 'active' check(lifecycle in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_dates_check check(ends_at is null or starts_at is null or ends_at>=starts_at)
);
create index meetings_championship_season_starts_idx
  on meetings(championship_id,season,starts_at,id);

create table meeting_events (
  meeting_id uuid not null references meetings(id) on delete restrict,
  event_id text not null references events(id) on delete restrict,
  position integer not null default 0 check(position>=0),
  created_at timestamptz not null default now(),
  primary key(meeting_id,event_id),
  unique(event_id)
);

create table normalized_identity_tombstones (
  normalized_uuid uuid primary key,
  resource_kind text not null check(resource_kind in ('event','meeting')),
  resource_id text not null check(btrim(resource_id)<>'' and length(resource_id)<=512),
  tombstoned_at timestamptz not null,
  reason text check(reason is null or length(reason)<=2000),
  unique(resource_kind,resource_id)
);

create function reject_tombstoned_normalized_identity() returns trigger
language plpgsql as $$
declare candidate_uuid uuid;
begin
  if tg_table_name='events' then
    candidate_uuid := new.normalized_uuid;
  else
    candidate_uuid := new.id;
  end if;
  if candidate_uuid is not null and exists(
    select 1 from normalized_identity_tombstones where normalized_uuid=candidate_uuid
  ) then
    raise exception 'Normalized UUID % is tombstoned and cannot be reused',candidate_uuid;
  end if;
  return new;
end $$;

create trigger events_reject_tombstoned_identity
before insert or update of normalized_uuid on events
for each row execute function reject_tombstoned_normalized_identity();
create trigger meetings_reject_tombstoned_identity
before insert or update of id on meetings
for each row execute function reject_tombstoned_normalized_identity();

create function reject_active_normalized_identity_tombstone() returns trigger
language plpgsql as $$
begin
  if exists(select 1 from events where normalized_uuid=new.normalized_uuid)
     or exists(select 1 from meetings where id=new.normalized_uuid) then
    raise exception 'Normalized UUID % is still active and cannot be tombstoned',new.normalized_uuid;
  end if;
  return new;
end $$;

create trigger normalized_identity_tombstones_reject_active
before insert or update of normalized_uuid on normalized_identity_tombstones
for each row execute function reject_active_normalized_identity_tombstone();

create table event_source_links (
  source_entity_id uuid primary key references provider_source_entities(id) on delete restrict,
  event_id text not null,
  normalized_event_uuid uuid not null,
  normalization_version text not null check(btrim(normalization_version)<>'' and length(normalization_version)<=128),
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint event_source_links_event_fk foreign key(event_id,normalized_event_uuid)
    references events(id,normalized_uuid) on delete restrict,
  unique(event_id,source_entity_id)
);
create index event_source_links_event_idx on event_source_links(event_id);

create table meeting_source_links (
  source_entity_id uuid primary key references provider_source_entities(id) on delete restrict,
  meeting_id uuid not null references meetings(id) on delete restrict,
  normalization_version text not null check(btrim(normalization_version)<>'' and length(normalization_version)<=128),
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(meeting_id,source_entity_id)
);
create index meeting_source_links_meeting_idx on meeting_source_links(meeting_id);

create table normalized_candidates (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  source_hash text not null check(btrim(source_hash)<>'' and length(source_hash)<=256),
  normalization_version text not null check(btrim(normalization_version)<>'' and length(normalization_version)<=128),
  resource_kind text not null check(resource_kind in ('event','meeting')),
  candidate_data jsonb not null check(jsonb_typeof(candidate_data)='object'),
  state text not null default 'pending' check(state in ('pending','review','promoted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint normalized_candidates_size_check check(octet_length(candidate_data::text)<=65536),
  unique(source_entity_id,source_hash,normalization_version,resource_kind)
);
create index normalized_candidates_source_idx
  on normalized_candidates(source_entity_id,created_at desc);

create table normalization_decisions (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  candidate_id uuid references normalized_candidates(id) on delete restrict,
  decision text not null check(decision in ('linked','rejected','review','create')),
  target_kind text check(target_kind is null or target_kind in ('event','meeting')),
  target_id text check(target_id is null or (btrim(target_id)<>'' and length(target_id)<=512)),
  normalization_version text not null check(btrim(normalization_version)<>'' and length(normalization_version)<=128),
  actor_id text not null check(btrim(actor_id)<>'' and length(actor_id)<=256),
  reason text check(reason is null or length(reason)<=2000),
  decided_at timestamptz not null default now(),
  constraint normalization_decisions_target_check check(
    (decision in ('linked','rejected') and target_kind is not null and target_id is not null)
    or (decision in ('review','create') and target_kind is null and target_id is null)
  ),
  constraint normalization_decisions_idempotency_unique unique nulls not distinct
    (source_entity_id,candidate_id,decision,target_kind,target_id,normalization_version)
);
create index normalization_decisions_source_idx
  on normalization_decisions(source_entity_id,decided_at desc);

create table normalization_checkpoints (
  scope_key text primary key check(btrim(scope_key)<>'' and length(scope_key)<=512),
  normalization_version text not null check(btrim(normalization_version)<>'' and length(normalization_version)<=128),
  last_source_entity_id uuid references provider_source_entities(id) on delete restrict,
  last_source_changed_at timestamptz,
  fence_generation bigint not null default 0 check(fence_generation>=0),
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into schema_migrations(version)
values('0024_lot57pa_normalized_persistence') on conflict do nothing;
