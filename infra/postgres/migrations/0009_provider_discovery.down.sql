do $$ begin
  if exists(select 1 from provider_discovered_championships) or exists(select 1 from provider_discovery_runs) then
    raise exception 'Refusing to remove provider discovery history; export and clean it first';
  end if;
end $$;
drop table provider_discovery_runs;
drop table provider_discovered_championships;
alter table provider_instances drop column last_discovery_at, drop column discovery_interval_days, drop column discovery_enabled;
delete from schema_migrations where version='0009_provider_discovery';
