do $$
declare dependency text;
begin
  if exists(select 1 from meetings where venue_id is not null or venue_layout_id is not null)
    or exists(select 1 from events where venue_id is not null or venue_layout_id is not null or session_type_key is not null)
    or exists(select 1 from normalization_decisions)
    or exists(select 1 from normalized_candidates) then
    raise exception 'Refusing 0036 rollback while F5-5 Meeting/Event resolution data exists';
  end if;
  select constraint_name into dependency from (
    select constraint_row.conname constraint_name
      from pg_constraint constraint_row
     where constraint_row.conname not in (
       'meetings_layout_requires_venue_check','meetings_venue_layout_scope_fk',
       'meetings_venue_id_fkey',
       'events_layout_requires_venue_check','events_venue_layout_scope_fk','events_canonical_session_type_check',
       'events_venue_id_fkey','events_session_type_key_fkey',
       'normalized_candidates_id_revision_unique',
       'normalization_decisions_idempotency_key_check','normalization_decisions_fingerprint_check',
       'normalization_decisions_candidate_key_unique','normalization_decisions_target_check'
     ) and (
       (constraint_row.conrelid='meetings'::regclass and constraint_row.conkey && array[
         (select attnum from pg_attribute where attrelid='meetings'::regclass and attname='venue_id'),
         (select attnum from pg_attribute where attrelid='meetings'::regclass and attname='venue_layout_id')
       ]::smallint[])
       or (constraint_row.conrelid='events'::regclass and constraint_row.conkey && array[
         (select attnum from pg_attribute where attrelid='events'::regclass and attname='venue_id'),
         (select attnum from pg_attribute where attrelid='events'::regclass and attname='venue_layout_id'),
         (select attnum from pg_attribute where attrelid='events'::regclass and attname='session_type_key')
       ]::smallint[])
       or (constraint_row.confrelid='normalized_candidates'::regclass
         and constraint_row.confkey && array[(select attnum from pg_attribute where attrelid='normalized_candidates'::regclass and attname='revision')]::smallint[]
       )
     )
  ) dependencies limit 1;
  if dependency is not null then
    raise exception 'Refusing 0036 rollback because constraint % depends on F5-5 schema',dependency;
  end if;
end $$;

drop trigger normalization_decisions_apply_state on normalization_decisions;
drop function f5_apply_normalization_decision();
drop trigger normalization_decisions_immutable on normalization_decisions;
drop function f5_reject_normalization_decision_mutation();
alter table normalization_decisions
  drop constraint normalization_decisions_target_check,
  drop constraint normalization_decisions_candidate_key_unique,
  drop constraint normalization_decisions_fingerprint_check,
  drop constraint normalization_decisions_idempotency_key_check,
  alter column candidate_id drop not null,
  drop column decision_fingerprint,
  drop column idempotency_key,
  drop column candidate_revision;
alter table normalization_decisions add constraint normalization_decisions_target_check check(
  (decision in ('linked','rejected') and target_kind is not null and target_id is not null)
  or (decision in ('review','create') and target_kind is null and target_id is null)
);
alter table normalized_candidates
  drop constraint normalized_candidates_id_revision_unique,
  drop column resolution_state,
  drop column revision;

drop trigger meetings_canonical_child_integrity on meetings;
drop function f5_check_event_parent_from_meeting();
drop trigger meeting_events_canonical_parent_integrity on meeting_events;
drop trigger events_canonical_parent_required on events;
drop function f5_check_event_parent_from_relation();
drop function f5_check_event_parent_from_event();
drop function f5_validate_canonical_event_parent(text);

drop index events_session_type_idx;
drop index events_layout_idx;
drop index events_venue_idx;
drop index meetings_layout_idx;
drop index meetings_venue_idx;
alter table events
  drop constraint events_canonical_session_type_check,
  drop constraint events_venue_layout_scope_fk,
  drop constraint events_layout_requires_venue_check,
  drop column session_type_key,
  drop column venue_layout_id,
  drop column venue_id;
alter table meetings
  drop constraint meetings_venue_layout_scope_fk,
  drop constraint meetings_layout_requires_venue_check,
  drop column venue_layout_id,
  drop column venue_id;
delete from schema_migrations where version='0036_f5_meeting_event_canonical_resolution';
