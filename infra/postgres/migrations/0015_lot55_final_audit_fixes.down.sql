do $$ begin
  if exists(select 1 from provider_quota_runtime where next_eligible_at is not null)
    or exists(select 1 from provider_quota_observations where charge_sequence is not null) then
    raise exception 'Clear active quota diagnostics and sequence baselines before rolling back 0015_lot55_final_audit_fixes';
  end if;
end $$;

alter table provider_quota_observations
  drop constraint provider_quota_observations_charge_sequence_fk;
alter table provider_quota_observations drop column charge_sequence;
drop index if exists provider_request_charges_sequence_idx;
alter table provider_request_charges drop column charge_sequence;
alter table provider_quota_runtime drop column next_eligible_at;
delete from schema_migrations where version='0015_lot55_final_audit_fixes';
