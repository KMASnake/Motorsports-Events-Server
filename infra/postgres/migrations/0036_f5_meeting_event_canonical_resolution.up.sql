do $$ begin
  if not exists(select 1 from schema_migrations where version='0035_f5_provider_discovery_resolution') then
    raise exception 'Migration 0035_f5_provider_discovery_resolution must be applied first';
  end if;
end $$;

alter table meetings
  add column venue_id uuid references venues(id) on delete restrict,
  add column venue_layout_id uuid,
  add constraint meetings_layout_requires_venue_check
    check(venue_layout_id is null or venue_id is not null),
  add constraint meetings_venue_layout_scope_fk
    foreign key(venue_layout_id,venue_id) references venue_layouts(id,venue_id) on delete restrict;

alter table events
  add column venue_id uuid references venues(id) on delete restrict,
  add column venue_layout_id uuid,
  add column session_type_key text references session_types(key) on delete restrict,
  add constraint events_layout_requires_venue_check
    check(venue_layout_id is null or venue_id is not null),
  add constraint events_venue_layout_scope_fk
    foreign key(venue_layout_id,venue_id) references venue_layouts(id,venue_id) on delete restrict;

-- Exact data-backed keys are retained. Unknown legacy classifications become
-- `other` only in the new canonical field; category/session_title stay intact.
update events event
   set session_type_key=case
     when exists(select 1 from session_types type where type.key=event.category) then event.category
     else 'other'
   end
 where event.normalized_uuid is not null;

do $$ begin
  if exists(
    select 1 from events event left join meeting_events relation on relation.event_id=event.id
     where event.normalized_uuid is not null group by event.id having count(relation.meeting_id)<>1
  ) then raise exception 'Existing canonical Event is not attached to exactly one Meeting'; end if;
  if exists(
    select 1 from events event join meeting_events relation on relation.event_id=event.id join meetings meeting on meeting.id=relation.meeting_id
     where event.normalized_uuid is not null and event.championship_id is distinct from meeting.championship_id
  ) then raise exception 'Existing canonical Event has a cross-Championship Meeting'; end if;
end $$;

alter table events add constraint events_canonical_session_type_check
  check(normalized_uuid is null or session_type_key is not null);

create index meetings_venue_idx on meetings(venue_id) where venue_id is not null;
create index meetings_layout_idx on meetings(venue_layout_id) where venue_layout_id is not null;
create index events_venue_idx on events(venue_id) where venue_id is not null;
create index events_layout_idx on events(venue_layout_id) where venue_layout_id is not null;
create index events_session_type_idx on events(session_type_key) where session_type_key is not null;

create function f5_validate_canonical_event_parent(candidate_event_id text) returns void
language plpgsql as $$
declare canonical boolean; relation_count integer; event_championship text; meeting_championship text;
begin
  select normalized_uuid is not null,championship_id
    into canonical,event_championship from events where id=candidate_event_id;
  if not found or not canonical then return; end if;
  select count(*),min(meeting.championship_id)
    into relation_count,meeting_championship
    from meeting_events relation join meetings meeting on meeting.id=relation.meeting_id
   where relation.event_id=candidate_event_id;
  if relation_count<>1 then
    raise exception 'Canonical Event % must belong to exactly one Meeting',candidate_event_id using errcode='23514';
  end if;
  if meeting_championship is distinct from event_championship then
    raise exception 'Canonical Event % and Meeting championships differ',candidate_event_id using errcode='23514';
  end if;
end $$;

create function f5_check_event_parent_from_event() returns trigger language plpgsql as $$
begin perform f5_validate_canonical_event_parent(new.id); return null; end $$;
create function f5_check_event_parent_from_relation() returns trigger language plpgsql as $$
begin
  perform f5_validate_canonical_event_parent(coalesce(new.event_id,old.event_id));
  if tg_op='UPDATE' and old.event_id is distinct from new.event_id then
    perform f5_validate_canonical_event_parent(old.event_id);
  end if;
  return null;
end $$;
create function f5_check_event_parent_from_meeting() returns trigger language plpgsql as $$
declare child_event_id text;
begin
  for child_event_id in
    select relation.event_id from meeting_events relation where relation.meeting_id=new.id
  loop
    perform f5_validate_canonical_event_parent(child_event_id);
  end loop;
  return null;
end $$;

create constraint trigger events_canonical_parent_required
after insert or update of normalized_uuid,championship_id on events
deferrable initially deferred for each row execute function f5_check_event_parent_from_event();
create constraint trigger meeting_events_canonical_parent_integrity
after insert or update or delete on meeting_events
deferrable initially deferred for each row execute function f5_check_event_parent_from_relation();
create constraint trigger meetings_canonical_child_integrity
after update of championship_id on meetings
deferrable initially deferred for each row execute function f5_check_event_parent_from_meeting();

alter table normalized_candidates
  add column revision bigint not null default 1 check(revision>0),
  add column resolution_state text not null default 'PENDING'
    check(resolution_state in ('PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED')),
  add constraint normalized_candidates_id_revision_unique unique(id,revision);

update normalized_candidates candidate set resolution_state=case candidate.state
  when 'review' then 'REVIEW_REQUIRED'
  when 'rejected' then 'REJECTED'
  when 'promoted' then coalesce((select case decision.decision when 'linked' then 'RESOLVED_LINKED' else 'RESOLVED_CREATED' end
    from normalization_decisions decision where decision.candidate_id=candidate.id
    order by decision.decided_at desc,decision.id desc limit 1),'RESOLVED_CREATED')
  else 'PENDING' end;

alter table normalization_decisions
  add column candidate_revision bigint,
  add column idempotency_key text,
  add column decision_fingerprint text;

update normalization_decisions decision set
  candidate_revision=candidate.revision,
  idempotency_key='legacy:'||decision.id::text,
  decision_fingerprint=md5(decision.id::text)||md5(decision.id::text||':f5')
from normalized_candidates candidate where candidate.id=decision.candidate_id;

alter table normalization_decisions
  drop constraint normalization_decisions_target_check,
  alter column candidate_id set not null,
  alter column candidate_revision set not null,
  alter column idempotency_key set not null,
  alter column decision_fingerprint set not null,
  add constraint normalization_decisions_idempotency_key_check
    check(btrim(idempotency_key)<>'' and length(idempotency_key)<=200),
  add constraint normalization_decisions_fingerprint_check
    check(decision_fingerprint~'^[0-9a-f]{64}$'),
  add constraint normalization_decisions_candidate_key_unique unique(candidate_id,idempotency_key);
alter table normalization_decisions add constraint normalization_decisions_target_check check(
  (decision='linked' and target_kind is not null and target_id is not null)
  or (decision in ('review','create') and target_kind is null and target_id is null)
  or (decision='rejected' and ((target_kind is null and target_id is null) or (target_kind is not null and target_id is not null)))
);

create function f5_reject_normalization_decision_mutation() returns trigger language plpgsql as $$
begin raise exception 'Normalization decisions are append-only' using errcode='23514'; end $$;
create trigger normalization_decisions_immutable before update or delete on normalization_decisions
for each row execute function f5_reject_normalization_decision_mutation();

create function f5_apply_normalization_decision() returns trigger language plpgsql as $$
declare current_state text; next_state text;
begin
  select resolution_state into current_state from normalized_candidates
   where id=new.candidate_id and revision=new.candidate_revision for update;
  if not found then raise exception 'Normalization candidate revision is stale' using errcode='40001'; end if;
  next_state:=case new.decision
    when 'review' then 'REVIEW_REQUIRED'
    when 'linked' then 'RESOLVED_LINKED'
    when 'create' then 'RESOLVED_CREATED'
    when 'rejected' then 'REJECTED' end;
  if current_state not in ('PENDING','REVIEW_REQUIRED') then
    raise exception 'Normalization candidate is terminal' using errcode='23514';
  end if;
  if current_state='REVIEW_REQUIRED' and next_state='REVIEW_REQUIRED' then
    raise exception 'Normalization candidate review state is unchanged' using errcode='23514';
  end if;
  update normalized_candidates set resolution_state=next_state,updated_at=new.decided_at
   where id=new.candidate_id;
  return new;
end $$;
create trigger normalization_decisions_apply_state after insert on normalization_decisions
for each row execute function f5_apply_normalization_decision();

insert into schema_migrations(version) values('0036_f5_meeting_event_canonical_resolution');
