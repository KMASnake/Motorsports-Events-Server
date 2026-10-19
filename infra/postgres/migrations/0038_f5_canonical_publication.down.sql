do $$ begin
  if exists(select 1 from public_resource_states where resource_type in ('championshipSeason','venue','venueLayout'))
     or exists(select 1 from public_change_log where resource_type in ('championshipSeason','venue','venueLayout'))
     or exists(select 1 from public_resource_versions where resource_type in ('championshipSeason','venue','venueLayout')) then
    raise exception 'F5-7B rollback refused: canonical publication data exists';
  end if;
end $$;

alter table public_resource_states drop constraint public_resource_states_resource_type_check;
alter table public_resource_states add constraint public_resource_states_resource_type_check
  check(resource_type in ('event','meeting','championship'));

alter table public_change_log drop constraint public_change_log_resource_type_check;
alter table public_change_log add constraint public_change_log_resource_type_check
  check(resource_type in ('event','meeting','championship'));

alter table public_resource_versions drop constraint public_resource_versions_resource_type_check;
alter table public_resource_versions add constraint public_resource_versions_resource_type_check
  check(resource_type in ('event','meeting','championship'));

delete from schema_migrations where version='0038_f5_canonical_publication';
