do $$ begin
  if not exists(select 1 from schema_migrations where version='0026_legacy_provider_uuid_repair') then
    raise exception 'Migration 0026_legacy_provider_uuid_repair must be applied first';
  end if;
end $$;

create table public_resource_versions (
  resource_type text not null check(resource_type in ('event','meeting','championship')),
  resource_id uuid not null,
  revision bigint not null check(revision > 0),
  publication_sequence bigint not null references public_change_log(sequence) on delete restrict,
  operation text not null check(operation in ('created','updated','removed','availability_changed')),
  championship_id text,
  lifecycle text not null check(lifecycle in ('active','removed')),
  canonical_state jsonb,
  state_checksum text not null check(length(state_checksum)=64),
  published_at timestamptz not null,
  primary key(resource_type,resource_id,revision),
  unique(publication_sequence),
  check((lifecycle='active' and canonical_state is not null)
     or (lifecycle='removed' and canonical_state is null)),
  check(canonical_state is null or octet_length(canonical_state::text)<=65536)
);
create index public_resource_versions_snapshot_idx
  on public_resource_versions(resource_type,resource_id,publication_sequence desc);

create function reject_public_resource_version_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Public resource versions are immutable';
end $$;
create trigger public_resource_versions_immutable
before update or delete on public_resource_versions
for each row execute function reject_public_resource_version_mutation();

create table public_history_controls (
  singleton boolean primary key default true check(singleton),
  oldest_snapshot_sequence bigint not null check(oldest_snapshot_sequence>=0),
  oldest_change_sequence bigint not null check(oldest_change_sequence>=0),
  baseline_generated_sequences bigint[] not null default '{}',
  baseline_created_at timestamptz not null default now()
);
insert into public_history_controls(singleton,oldest_snapshot_sequence,oldest_change_sequence) values(true,0,0);

-- A pre-0027 database has only current state. Preserve that state as a
-- baseline without claiming that discarded earlier revisions were recovered.
do $$ declare state record; baseline_sequence bigint; baseline_operation text; begin
  for state in select * from public_resource_states order by resource_type,resource_id loop
    select sequence,operation into baseline_sequence,baseline_operation
      from public_change_log
      where resource_type=state.resource_type and resource_id=state.resource_id
        and resource_revision=state.revision;
    if baseline_sequence is null then
      insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at)
      values(state.resource_type,state.resource_id,state.revision,
        case when state.lifecycle='removed' then 'removed' else 'availability_changed' end,
      '{}',state.state_checksum,state.promoted_at)
      returning sequence,operation into baseline_sequence,baseline_operation;
      update public_history_controls set baseline_generated_sequences=array_append(baseline_generated_sequences,baseline_sequence) where singleton=true;
    end if;
    insert into public_resource_versions(resource_type,resource_id,revision,publication_sequence,operation,championship_id,lifecycle,canonical_state,state_checksum,published_at)
    values(state.resource_type,state.resource_id,state.revision,baseline_sequence,baseline_operation,state.championship_id,state.lifecycle,state.canonical_state,state.state_checksum,state.promoted_at);
  end loop;
end $$;

update public_history_controls
set oldest_snapshot_sequence=coalesce((select max(sequence) from public_change_log),0)
   ,oldest_change_sequence=coalesce((select max(sequence) from public_change_log),0)
where singleton=true;

insert into schema_migrations(version)
values('0027_lot57pc_public_resource_history');
