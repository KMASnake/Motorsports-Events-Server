update events e
set timezone = b.timezone
from migration_0002_event_timezone_backup b
where e.id = b.event_id;

insert into event_corrections
select * from archived_event_corrections where field_name = 'timezone'
on conflict (event_id, field_name) do update set
  provider_key = excluded.provider_key,
  external_id = excluded.external_id,
  provider_value = excluded.provider_value,
  override_value = excluded.override_value,
  status = excluded.status,
  created_by = excluded.created_by,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  last_provider_seen_at = excluded.last_provider_seen_at,
  conflict_detected_at = excluded.conflict_detected_at;

delete from archived_event_corrections where field_name = 'timezone';
drop table migration_0002_event_timezone_backup;
delete from schema_migrations where version = '0002_utc_storage';
