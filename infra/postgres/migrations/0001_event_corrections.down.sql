do $$
begin
  if exists(select 1 from event_corrections) then
    raise exception 'Refusing to drop event_corrections while correction rows remain';
  end if;
end $$;
drop table event_corrections;
delete from schema_migrations where version = '0001_event_corrections';
