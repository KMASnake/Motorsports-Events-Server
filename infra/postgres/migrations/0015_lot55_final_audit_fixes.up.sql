do $$ begin
  if not exists(select 1 from schema_migrations where version='0014_lot55_audit_fixes') then
    raise exception 'Migration 0014_lot55_audit_fixes must be applied first';
  end if;
end $$;

alter table provider_quota_runtime
  add column next_eligible_at timestamptz;

alter table provider_request_charges
  add column charge_sequence bigint generated always as identity;

create unique index provider_request_charges_sequence_idx
  on provider_request_charges(charge_sequence);

alter table provider_quota_observations
  add column charge_sequence bigint;

alter table provider_quota_observations
  add constraint provider_quota_observations_charge_sequence_fk
  foreign key(charge_sequence) references provider_request_charges(charge_sequence)
  on delete set null;

insert into schema_migrations(version)
values('0015_lot55_final_audit_fixes') on conflict do nothing;
