do $$
declare populated boolean;
begin
  select exists(select 1 from meeting_events)
      or exists(select 1 from event_source_links)
      or exists(select 1 from meeting_source_links)
      or exists(select 1 from normalized_candidates)
      or exists(select 1 from normalization_decisions)
      or exists(select 1 from normalization_checkpoints)
      or exists(select 1 from normalized_identity_tombstones)
      or exists(select 1 from meetings)
      or exists(select 1 from events where normalized_uuid is not null)
    into populated;
  if populated and current_setting('mse.allow_destructive_lot57pa_down',true) is distinct from 'on' then
    raise exception using message='Destructive Lot 5.7-P-A rollback refused: normalized persistence data exists.',hint='Set mse.allow_destructive_lot57pa_down=on only on a disposable database where data loss is explicitly accepted.';
  end if;
  if populated then raise warning 'DESTRUCTIVE OPERATION: dropping Lot 5.7-P-A normalized persistence data'; end if;
end $$;

drop table normalization_checkpoints;
drop table normalization_decisions;
drop table normalized_candidates;
drop table meeting_source_links;
drop table event_source_links;
drop trigger normalized_identity_tombstones_reject_active on normalized_identity_tombstones;
drop function reject_active_normalized_identity_tombstone();
drop trigger meetings_reject_tombstoned_identity on meetings;
drop trigger events_reject_tombstoned_identity on events;
drop function reject_tombstoned_normalized_identity();
drop table normalized_identity_tombstones;
drop table meeting_events;
drop table meetings;
alter table events
  drop constraint events_id_normalized_uuid_unique,
  drop constraint events_removed_identity_check,
  drop constraint events_normalized_uuid_unique,
  drop column normalized_lifecycle,
  drop column normalized_uuid;
delete from schema_migrations where version='0024_lot57pa_normalized_persistence';
