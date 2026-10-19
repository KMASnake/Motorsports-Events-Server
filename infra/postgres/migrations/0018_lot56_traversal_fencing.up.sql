alter table provider_acquisition_traversals
  add column lease_generation bigint;

update provider_acquisition_traversals traversal
set lease_generation=run.lease_generation
from sync_runs run
where run.id=traversal.run_id;

do $$
begin
  if exists(select 1 from provider_acquisition_traversals where lease_generation is null) then
    raise exception 'Cannot fence acquisition traversal without its originating lease generation';
  end if;
end $$;

alter table provider_acquisition_traversals
  alter column lease_generation set not null,
  add constraint provider_acquisition_traversals_lease_generation_ck
    check(lease_generation >= 1);

create index provider_acquisition_traversals_ownership_idx
  on provider_acquisition_traversals(id,run_id,lease_generation)
  where complete=false;

insert into schema_migrations(version)
values('0018_lot56_traversal_fencing') on conflict do nothing;
