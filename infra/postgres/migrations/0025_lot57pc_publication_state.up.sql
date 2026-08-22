do $$ begin
  if not exists(select 1 from schema_migrations where version='0024_lot57pa_normalized_persistence') then
    raise exception 'Migration 0024_lot57pa_normalized_persistence must be applied first';
  end if;
end $$;

create table publication_controls (
  control_key text primary key,
  enabled boolean not null default true,
  revision bigint not null default 1 check(revision > 0),
  updated_at timestamptz not null default now(),
  check(control_key='promotion')
);
insert into publication_controls(control_key,enabled) values('promotion',true);

create table public_resource_states (
  resource_type text not null check(resource_type in ('event','meeting','championship')),
  resource_id uuid not null,
  championship_id text,
  revision bigint not null check(revision > 0),
  lifecycle text not null check(lifecycle in ('active','removed')),
  canonical_state jsonb,
  state_checksum text not null check(length(state_checksum)=64),
  promoted_candidate_id uuid references normalized_candidates(id) on delete restrict,
  promoted_at timestamptz not null,
  removed_at timestamptz,
  primary key(resource_type,resource_id),
  check((lifecycle='active' and canonical_state is not null and removed_at is null)
     or (lifecycle='removed' and canonical_state is null and removed_at is not null)),
  check(canonical_state is null or octet_length(canonical_state::text)<=65536)
);
create index public_resource_states_championship_idx
  on public_resource_states(championship_id,resource_type,resource_id) where lifecycle='active';
create index public_resource_states_tombstone_idx
  on public_resource_states(resource_type,resource_id) where lifecycle='removed';

create sequence public_change_sequence as bigint;
create table public_change_log (
  sequence bigint primary key default nextval('public_change_sequence'),
  resource_type text not null check(resource_type in ('event','meeting','championship')),
  resource_id uuid not null,
  resource_revision bigint not null check(resource_revision > 0),
  operation text not null check(operation in ('created','updated','removed','availability_changed')),
  changed_fields text[] not null,
  state_checksum text not null check(length(state_checksum)=64),
  occurred_at timestamptz not null,
  unique(resource_type,resource_id,resource_revision)
);
create index public_change_log_resource_idx on public_change_log(resource_type,resource_id,sequence);

create table publication_receipts (
  candidate_id uuid primary key references normalized_candidates(id) on delete restrict,
  resource_type text not null check(resource_type in ('event','meeting')),
  resource_id uuid not null,
  effective_checksum text not null check(length(effective_checksum)=64),
  resource_revision bigint not null check(resource_revision > 0),
  change_sequence bigint references public_change_log(sequence) on delete restrict,
  outcome text not null check(outcome in ('created','updated','unchanged')),
  committed_at timestamptz not null
);

create function reject_public_tombstone_mutation() returns trigger language plpgsql as $$
begin
  if old.lifecycle='removed' and new is distinct from old then
    raise exception 'Public tombstone %/% is permanent',old.resource_type,old.resource_id;
  end if;
  return new;
end $$;
create trigger public_resource_states_permanent_tombstone
before update on public_resource_states for each row execute function reject_public_tombstone_mutation();

create table publication_rebuild_checkpoints (
  scope_key text primary key check(btrim(scope_key)<>'' and length(scope_key)<=512),
  last_candidate_id uuid references normalized_candidates(id) on delete restrict,
  revision bigint not null default 1 check(revision > 0),
  updated_at timestamptz not null default now()
);

insert into schema_migrations(version) values('0025_lot57pc_publication_state');
