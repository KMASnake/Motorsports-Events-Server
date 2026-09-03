do $$ begin
  if not exists (select 1 from schema_migrations where version='0009_provider_discovery') then
    raise exception 'Migration 0009_provider_discovery must be applied first';
  end if;
end $$;

alter table provider_discovery_runs add column is_complete boolean;

insert into schema_migrations(version) values('0010_provider_discovery_completeness') on conflict do nothing;
