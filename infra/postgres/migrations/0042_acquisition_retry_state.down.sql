do $$ begin
  if exists(select 1 from provider_acquisition_retry_units) then
    raise exception 'Cannot remove acquisition retry state while durable units exist';
  end if;
end $$;
drop table provider_acquisition_retry_charges;
drop table provider_acquisition_retry_units;
delete from schema_migrations where version='0042_acquisition_retry_state';
