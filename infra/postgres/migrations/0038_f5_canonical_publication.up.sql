do $$ begin
  if not exists(select 1 from schema_migrations where version='0037_f5_multi_provider_reconciliation') then
    raise exception 'Migration 0037_f5_multi_provider_reconciliation must be applied first';
  end if;
end $$;

alter table public_resource_states drop constraint public_resource_states_resource_type_check;
alter table public_resource_states add constraint public_resource_states_resource_type_check
  check(resource_type in ('event','meeting','championship','championshipSeason','venue','venueLayout'));

alter table public_change_log drop constraint public_change_log_resource_type_check;
alter table public_change_log add constraint public_change_log_resource_type_check
  check(resource_type in ('event','meeting','championship','championshipSeason','venue','venueLayout'));

alter table public_resource_versions drop constraint public_resource_versions_resource_type_check;
alter table public_resource_versions add constraint public_resource_versions_resource_type_check
  check(resource_type in ('event','meeting','championship','championshipSeason','venue','venueLayout'));

insert into schema_migrations(version) values('0038_f5_canonical_publication');
