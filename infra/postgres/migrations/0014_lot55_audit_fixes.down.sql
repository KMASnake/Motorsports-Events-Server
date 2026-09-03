do $$ begin
  if exists(select 1 from provider_instances where discovery_next_eligible_at is not null)
    or exists(select 1 from provider_discovery_runs where next_eligible_at is not null) then
    raise exception 'Clear persisted discovery quota deferrals before rolling back 0014_lot55_audit_fixes';
  end if;
end $$;

drop index if exists provider_instances_discovery_eligibility_idx;
alter table provider_discovery_runs drop column next_eligible_at;
alter table provider_instances drop column discovery_next_eligible_at;
delete from schema_migrations where version='0014_lot55_audit_fixes';
