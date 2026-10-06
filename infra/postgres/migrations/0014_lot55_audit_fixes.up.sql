do $$ begin
  if not exists(select 1 from schema_migrations where version='0013_provider_quota_cadence') then
    raise exception 'Migration 0013_provider_quota_cadence must be applied first';
  end if;
end $$;

alter table provider_instances
  add column discovery_next_eligible_at timestamptz;

alter table provider_discovery_runs
  add column next_eligible_at timestamptz;

create index provider_instances_discovery_eligibility_idx
  on provider_instances(discovery_next_eligible_at)
  where discovery_enabled;

insert into schema_migrations(version)
values('0014_lot55_audit_fixes') on conflict do nothing;
