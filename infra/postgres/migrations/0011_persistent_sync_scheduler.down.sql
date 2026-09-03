do $$ begin
  if exists(select 1 from sync_streams) or exists(select 1 from sync_runs) then raise exception 'Export and remove Lot 5.4 streams/runs before rollback'; end if;
end $$;
drop table sync_runs;
drop table sync_streams;
drop table scheduler_configuration;
alter table provider_championships drop column current_window_days;
alter table provider_instances drop column discovery_lease_owner,drop column discovery_lease_expires_at,drop column discovery_lease_generation;
delete from schema_migrations where version='0011_persistent_sync_scheduler';
