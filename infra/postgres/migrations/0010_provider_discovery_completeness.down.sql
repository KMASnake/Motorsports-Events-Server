do $$ begin
  if exists(select 1 from provider_discovery_runs) then
    raise exception 'Refusing to remove discovery completeness from existing history; export and clean it first';
  end if;
end $$;
alter table provider_discovery_runs drop column is_complete;
delete from schema_migrations where version='0010_provider_discovery_completeness';
