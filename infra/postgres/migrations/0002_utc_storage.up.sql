create table if not exists migration_0002_event_timezone_backup (
  event_id text primary key references events(id) on delete cascade,
  timezone text not null
);

create table if not exists archived_event_corrections (
  like event_corrections including defaults including constraints including indexes
);

insert into migration_0002_event_timezone_backup(event_id, timezone)
select id, timezone from events where timezone is distinct from 'UTC'
on conflict (event_id) do nothing;

insert into archived_event_corrections
select * from event_corrections where field_name = 'timezone'
on conflict (id) do update set
  provider_value = excluded.provider_value,
  override_value = excluded.override_value,
  status = excluded.status,
  updated_at = excluded.updated_at,
  last_provider_seen_at = excluded.last_provider_seen_at,
  conflict_detected_at = excluded.conflict_detected_at;

delete from event_corrections where field_name = 'timezone';
update events set timezone = 'UTC' where timezone is distinct from 'UTC';
insert into schema_migrations(version) values ('0002_utc_storage') on conflict do nothing;
