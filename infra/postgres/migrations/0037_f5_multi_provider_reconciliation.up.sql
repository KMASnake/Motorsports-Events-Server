do $$ begin
  if not exists(select 1 from schema_migrations where version='0036_f5_meeting_event_canonical_resolution') then
    raise exception 'Migration 0036_f5_meeting_event_canonical_resolution must be applied first';
  end if;
end $$;

create table reconciliation_policies (
  id uuid primary key,
  championship_id text not null references championships(id) on delete restrict,
  championship_season_id uuid references championship_seasons(id) on delete restrict,
  resource_kind text not null check(resource_kind in ('meeting','event')),
  version integer not null check(version>0),
  status text not null check(status in ('draft','active','retired')),
  evaluation_defaults jsonb not null default '{}'::jsonb,
  checksum text not null check(checksum~'^[0-9a-f]{64}$'),
  idempotency_key text not null check(btrim(idempotency_key)<>''),
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  actor_id text not null check(btrim(actor_id)<>''),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  unique(championship_id,championship_season_id,resource_kind,version),
  unique(championship_id,championship_season_id,resource_kind,idempotency_key),
  check((status='draft' and activated_at is null and retired_at is null)
    or (status='active' and activated_at is not null and retired_at is null)
    or (status='retired' and activated_at is not null and retired_at is not null))
);
create unique index reconciliation_policies_one_active_idx
  on reconciliation_policies(championship_id,coalesce(championship_season_id,'00000000-0000-0000-0000-000000000000'::uuid),resource_kind)
  where status='active';

-- A source correction lifecycle transition is a new normalization input even
-- when the immutable provider payload itself has not changed.
alter table normalized_candidates
  drop constraint normalized_candidates_source_entity_id_source_hash_normaliz_key;
alter table normalized_candidates
  add column source_correction_set_checksum text not null
    default '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
    check(source_correction_set_checksum~'^[0-9a-f]{64}$');
alter table normalized_candidates
  add constraint normalized_candidates_source_correction_identity_key
  unique(source_entity_id,source_hash,normalization_version,resource_kind,source_correction_set_checksum);

-- This revision is the persisted source-state succession order. It advances
-- only when acquisition observes a different source hash and is frozen into
-- the normalized candidate and contribution. Receipt timestamps never decide
-- which contribution version supersedes another.
alter table provider_source_entities
  add column source_revision bigint not null default 1 check(source_revision>0);

create table reconciliation_policy_field_rules (
  id uuid primary key,
  policy_id uuid not null references reconciliation_policies(id) on delete restrict,
  field_name text not null,
  field_class text not null check(field_class in ('IDENTITY','STRUCTURAL','SCHEDULE','STATUS','DISPLAY','REFERENCE')),
  provider_priority jsonb not null,
  schedule_tolerance_seconds integer check(schedule_tolerance_seconds is null or schedule_tolerance_seconds>=0),
  stale_after_seconds integer check(stale_after_seconds is null or stale_after_seconds>0),
  status_rules jsonb not null default '{}'::jsonb,
  unique(policy_id,field_name),
  check(field_class<>'IDENTITY'),
  check(jsonb_typeof(provider_priority)='array')
);

create table meeting_source_contributions (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  source_link_id uuid not null references meeting_source_links(source_entity_id) on delete restrict,
  meeting_id uuid not null references meetings(id) on delete restrict,
  normalization_version text not null,
  source_checksum text not null check(source_checksum~'^[0-9a-f]{64}$'),
  contribution_checksum text not null check(contribution_checksum~'^[0-9a-f]{64}$'),
  source_correction_provenance jsonb not null default '[]'::jsonb,
  normalized_values jsonb not null,
  structural_references jsonb not null,
  observed_at timestamptz not null,
  received_at timestamptz not null,
  source_updated_at timestamptz,
  source_revision bigint not null default 1 check(source_revision>0),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_entity_id,contribution_checksum),
  check(jsonb_typeof(source_correction_provenance)='array'),
  check(jsonb_typeof(normalized_values)='object'),
  check(jsonb_typeof(structural_references)='object')
);

create table event_source_contributions (
  id uuid primary key,
  source_entity_id uuid not null references provider_source_entities(id) on delete restrict,
  source_link_id uuid not null references event_source_links(source_entity_id) on delete restrict,
  event_uuid uuid not null,
  event_id text not null references events(id) on delete restrict,
  meeting_id uuid not null references meetings(id) on delete restrict,
  normalization_version text not null,
  source_checksum text not null check(source_checksum~'^[0-9a-f]{64}$'),
  contribution_checksum text not null check(contribution_checksum~'^[0-9a-f]{64}$'),
  source_correction_provenance jsonb not null default '[]'::jsonb,
  normalized_values jsonb not null,
  structural_references jsonb not null,
  observed_at timestamptz not null,
  received_at timestamptz not null,
  source_updated_at timestamptz,
  source_revision bigint not null default 1 check(source_revision>0),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_entity_id,contribution_checksum),
  unique(id,event_uuid),
  foreign key(event_id,event_uuid) references events(id,normalized_uuid) on delete restrict,
  foreign key(meeting_id,event_id) references meeting_events(meeting_id,event_id) on delete restrict,
  check(jsonb_typeof(source_correction_provenance)='array'),
  check(jsonb_typeof(normalized_values)='object'),
  check(jsonb_typeof(structural_references)='object')
);

create table contribution_status_events (
  id uuid primary key,
  contribution_kind text not null check(contribution_kind in ('meeting','event')),
  contribution_id uuid not null,
  status text not null check(status in ('active','withdrawn')),
  occurred_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique(contribution_kind,contribution_id,status,occurred_at)
);

create table canonical_field_overrides (
  id uuid primary key,
  entity_kind text not null check(entity_kind in ('meeting','event')),
  entity_uuid uuid not null,
  canonical_record_id text not null,
  field_name text not null,
  override_value jsonb not null,
  provider_value_at_creation jsonb,
  reason text not null check(btrim(reason)<>''),
  actor_id text not null check(btrim(actor_id)<>''),
  status text not null check(status in ('active','revoked')),
  revision bigint not null default 1 check(revision>0),
  idempotency_key text not null check(btrim(idempotency_key)<>''),
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  legacy_event_correction_id text unique,
  legacy_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(entity_kind,entity_uuid,idempotency_key),
  check((status='active' and revoked_at is null) or (status='revoked' and revoked_at is not null)),
  check(not (entity_kind='event' and field_name in ('id','normalized_uuid','meeting_id','championship_id','championship_season_id'))),
  check(not (entity_kind='meeting' and field_name in ('id','championship_id','championship_season_id')))
);
create unique index canonical_field_overrides_one_active_idx
  on canonical_field_overrides(entity_kind,entity_uuid,field_name) where status='active';

create table canonical_field_override_history (
  id uuid primary key,
  override_id uuid not null references canonical_field_overrides(id) on delete restrict,
  revision bigint not null,
  operation text not null check(operation in ('created','updated','revoked','imported','provider_observed')),
  value jsonb,
  actor_id text not null,
  reason text not null,
  occurred_at timestamptz not null default now(),
  unique(override_id,revision)
);
create table canonical_override_mutations (
  id uuid primary key,
  entity_kind text not null check(entity_kind in ('meeting','event')),
  entity_uuid uuid not null,
  idempotency_key text not null,
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  override_id uuid not null references canonical_field_overrides(id) on delete restrict,
  operation text not null check(operation in ('set','revoke','provider_observation')),
  resulting_revision bigint not null check(resulting_revision>0),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(entity_kind,entity_uuid,idempotency_key)
);

create table reconciliation_runs (
  id uuid primary key,
  entity_kind text not null check(entity_kind in ('meeting','event')),
  entity_uuid uuid not null,
  policy_id uuid not null references reconciliation_policies(id) on delete restrict,
  evaluation_at timestamptz not null,
  contribution_set_checksum text not null check(contribution_set_checksum~'^[0-9a-f]{64}$'),
  override_set_checksum text not null check(override_set_checksum~'^[0-9a-f]{64}$'),
  preview_checksum text not null check(preview_checksum~'^[0-9a-f]{64}$'),
  effective_checksum text not null check(effective_checksum~'^[0-9a-f]{64}$'),
  mode text not null check(mode in ('preview','apply')),
  outcome text not null check(outcome in ('no_op','applied','review_required','degraded')),
  expected_revision_delta integer not null check(expected_revision_delta in (0,1)),
  expected_public_change_delta integer not null check(expected_public_change_delta in (0,1)),
  idempotency_key text not null,
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  actor_id text not null,
  created_at timestamptz not null default now(),
  unique(entity_kind,entity_uuid,idempotency_key)
);

create table reconciliation_field_decisions (
  id uuid primary key,
  run_id uuid not null references reconciliation_runs(id) on delete restrict,
  field_name text not null,
  outcome text not null check(outcome in ('selected','override','auto_resolved','review_required','degraded')),
  effective_value jsonb,
  winning_contribution_id uuid,
  provenance jsonb not null,
  unique(run_id,field_name)
);

create table reconciliation_conflicts (
  id uuid primary key,
  entity_kind text not null check(entity_kind in ('meeting','event')),
  entity_uuid uuid not null,
  field_name text not null,
  policy_id uuid not null references reconciliation_policies(id) on delete restrict,
  contribution_set_checksum text not null check(contribution_set_checksum~'^[0-9a-f]{64}$'),
  severity text not null check(severity in ('warning','critical')),
  status text not null check(status in ('AUTO_RESOLVED','REVIEW_REQUIRED','ADMIN_OVERRIDE','RESOLVED','SUPERSEDED')),
  details jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_kind,entity_uuid,field_name,policy_id,contribution_set_checksum)
);

-- Active/conflicting Event overrides must map unambiguously to a canonical UUID.
do $$ begin
  if exists(
    select 1 from event_corrections correction
    left join events event on event.id=correction.event_id
    where correction.status in ('active','conflict') and event.normalized_uuid is null
  ) then raise exception 'Active legacy Event correction cannot be mapped to a canonical Event UUID'; end if;
end $$;

insert into canonical_field_overrides(
  id,entity_kind,entity_uuid,canonical_record_id,field_name,override_value,
  provider_value_at_creation,reason,actor_id,status,revision,idempotency_key,
  request_fingerprint,legacy_event_correction_id,legacy_status,created_at,updated_at
)
select md5('legacy-event-correction:'||correction.id)::uuid,'event',event.normalized_uuid,event.id,
  correction.field_name,correction.override_value,correction.provider_value,
  'Imported from legacy event_corrections',correction.created_by,'active',1,
  'legacy:'||correction.id,
  encode(sha256(convert_to(concat_ws('|',correction.id,correction.event_id,correction.field_name,
    correction.override_value::text,coalesce(correction.provider_value::text,'null'),correction.status),'UTF8')),'hex'),
  correction.id,correction.status,correction.created_at,correction.updated_at
from event_corrections correction join events event on event.id=correction.event_id
where correction.status in ('active','conflict')
on conflict(legacy_event_correction_id) do update set
  legacy_event_correction_id=excluded.legacy_event_correction_id
where canonical_field_overrides.request_fingerprint=excluded.request_fingerprint;

do $$ begin
  if exists(
    select 1 from event_corrections correction join canonical_field_overrides override
      on override.legacy_event_correction_id=correction.id
    where correction.status in ('active','conflict') and override.request_fingerprint<>
      encode(sha256(convert_to(concat_ws('|',correction.id,correction.event_id,correction.field_name,
        correction.override_value::text,coalesce(correction.provider_value::text,'null'),correction.status),'UTF8')),'hex')
  ) then raise exception 'Legacy Event correction import fingerprint is divergent'; end if;
  if (select count(*) from event_corrections where status in ('active','conflict')) <>
     (select count(*) from canonical_field_overrides where legacy_event_correction_id is not null) then
    raise exception 'Legacy Event correction import is divergent';
  end if;
end $$;

insert into canonical_field_override_history(id,override_id,revision,operation,value,actor_id,reason,occurred_at)
select md5('legacy-event-correction-history:'||legacy_event_correction_id)::uuid,id,1,'imported',override_value,actor_id,reason,created_at
from canonical_field_overrides where legacy_event_correction_id is not null
on conflict(override_id,revision) do nothing;

-- Lookup paths used by reconciliation: canonical target first, then immutable
-- per-source semantic revision. Target indexes cover the exact ordered snapshot
-- read, including withdrawn evidence needed to bind preview/apply checksums.
create index meeting_source_contributions_target_revision_idx on meeting_source_contributions(meeting_id,source_entity_id,source_revision,contribution_checksum,id);
create index event_source_contributions_target_revision_idx on event_source_contributions(event_uuid,source_entity_id,source_revision,contribution_checksum,id);
create index meeting_source_contributions_source_revision_idx on meeting_source_contributions(source_entity_id,source_revision desc,contribution_checksum);
create index event_source_contributions_source_revision_idx on event_source_contributions(source_entity_id,source_revision desc,contribution_checksum);
create index reconciliation_runs_entity_created_idx on reconciliation_runs(entity_kind,entity_uuid,created_at desc);
create index reconciliation_conflicts_open_idx on reconciliation_conflicts(entity_kind,entity_uuid,field_name) where status='REVIEW_REQUIRED';

create function f5_reject_evidence_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only evidence',tg_table_name using errcode='23514'; end $$;
create trigger reconciliation_runs_append_only before update or delete on reconciliation_runs for each row execute function f5_reject_evidence_mutation();
create trigger reconciliation_field_decisions_append_only before update or delete on reconciliation_field_decisions for each row execute function f5_reject_evidence_mutation();
create trigger canonical_field_override_history_append_only before update or delete on canonical_field_override_history for each row execute function f5_reject_evidence_mutation();
create trigger canonical_override_mutations_append_only before update or delete on canonical_override_mutations for each row execute function f5_reject_evidence_mutation();
create trigger contribution_status_events_append_only before update or delete on contribution_status_events for each row execute function f5_reject_evidence_mutation();

create function f5_guard_contribution_snapshot() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception '% contribution snapshots cannot be deleted',tg_table_name using errcode='23514'; end if;
  if (to_jsonb(new)-'withdrawn_at') is distinct from (to_jsonb(old)-'withdrawn_at') then raise exception '% contribution snapshot is immutable',tg_table_name using errcode='23514'; end if;
  return new;
end $$;
create trigger meeting_source_contributions_immutable before update or delete on meeting_source_contributions for each row execute function f5_guard_contribution_snapshot();
create trigger event_source_contributions_immutable before update or delete on event_source_contributions for each row execute function f5_guard_contribution_snapshot();

create function f5_record_contribution_status() returns trigger language plpgsql as $$
declare kind text:=case when tg_table_name='meeting_source_contributions' then 'meeting' else 'event' end;
begin
  if tg_op='INSERT' then insert into contribution_status_events(id,contribution_kind,contribution_id,status,occurred_at,reason) values(gen_random_uuid(),kind,new.id,case when new.withdrawn_at is null then 'active' else 'withdrawn' end,coalesce(new.withdrawn_at,new.created_at),'contribution persisted');
  elsif new.withdrawn_at is distinct from old.withdrawn_at then insert into contribution_status_events(id,contribution_kind,contribution_id,status,occurred_at,reason) values(gen_random_uuid(),kind,new.id,case when new.withdrawn_at is null then 'active' else 'withdrawn' end,coalesce(new.withdrawn_at,now()),'eligibility lifecycle transition') on conflict(contribution_kind,contribution_id,status,occurred_at) do nothing; end if;
  return new;
end $$;
create trigger meeting_source_contributions_status after insert or update of withdrawn_at on meeting_source_contributions for each row execute function f5_record_contribution_status();
create trigger event_source_contributions_status after insert or update of withdrawn_at on event_source_contributions for each row execute function f5_record_contribution_status();

create function f5_validate_override_identity() returns trigger language plpgsql as $$
begin
  if new.entity_kind='meeting' and not exists(select 1 from meetings where id=new.entity_uuid and id::text=new.canonical_record_id) then raise exception 'canonical Meeting identity mismatch' using errcode='23514'; end if;
  if new.entity_kind='event' and not exists(select 1 from events where normalized_uuid=new.entity_uuid and id=new.canonical_record_id) then raise exception 'canonical Event identity mismatch' using errcode='23514'; end if;
  return new;
end $$;
create trigger canonical_field_overrides_identity before insert or update of entity_kind,entity_uuid,canonical_record_id on canonical_field_overrides for each row execute function f5_validate_override_identity();

create function f5_reject_legacy_event_correction_write() returns trigger language plpgsql as $$
begin raise exception 'event_corrections is read-only after 0037; use canonical_field_overrides' using errcode='23514'; end $$;
create trigger event_corrections_read_only before insert or update or delete on event_corrections
for each row execute function f5_reject_legacy_event_correction_write();

create function f5_reject_active_policy_mutation() returns trigger language plpgsql as $$
begin
  if old.status='retired' or (old.status='active' and not (tg_op='UPDATE' and new.status='retired')) then
    raise exception 'Activated reconciliation policies are immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger reconciliation_policies_immutable before update or delete on reconciliation_policies
for each row execute function f5_reject_active_policy_mutation();

create function f5_reject_active_policy_rule_mutation() returns trigger language plpgsql as $$
declare target_policy uuid:=coalesce(new.policy_id,old.policy_id);
begin
  if exists(select 1 from reconciliation_policies where id=target_policy and status in('active','retired')) then
    raise exception 'Rules of activated reconciliation policies are immutable' using errcode='23514';
  end if;
  return coalesce(new,old);
end $$;
create trigger reconciliation_policy_field_rules_immutable before update or delete on reconciliation_policy_field_rules
for each row execute function f5_reject_active_policy_rule_mutation();

insert into schema_migrations(version) values('0037_f5_multi_provider_reconciliation');
