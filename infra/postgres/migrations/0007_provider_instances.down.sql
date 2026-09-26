do $$
begin
  if exists (
    select 1 from schema_migrations
    where version = '0008_provider_championship_sources'
  ) then
    raise exception 'Rollback 0008_provider_championship_sources before 0007_provider_instances';
  end if;

  if exists (select 1 from provider_instances) then
    raise exception 'Refusing to remove provider_instances while provider rows remain; export and clean them first';
  end if;
end $$;

drop table provider_quota_state;
drop table provider_quota_policies;
drop index if exists provider_secrets_provider_idx;
drop table provider_secrets;
drop index if exists provider_instances_state_enabled_idx;
drop index if exists provider_instances_name_unique;
drop table provider_instances;
delete from schema_migrations where version = '0007_provider_instances';
