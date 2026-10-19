do $$
declare dependency record;
begin
  if exists(select 1 from circuit_venue_links) then
    raise exception 'Refusing 0034 rollback while circuit venue links contain data';
  end if;
  if exists(select 1 from venue_layouts) then
    raise exception 'Refusing 0034 rollback while venue layouts contain data';
  end if;
  if exists(select 1 from venues) then
    raise exception 'Refusing 0034 rollback while venues contain data';
  end if;
  if exists(select 1 from venue_kinds where key not in ('circuit','street_circuit','rally_location','service_park','stage_location','test_track','other')) then
    raise exception 'Refusing 0034 rollback while venue kinds contain extension data';
  end if;
  select conrelid::regclass::text as relation_name into dependency
    from pg_constraint
   where contype='f'
     and confrelid in ('venue_kinds'::regclass,'venues'::regclass,'venue_layouts'::regclass,'circuit_venue_links'::regclass)
     and conrelid not in ('venue_kinds'::regclass,'venues'::regclass,'venue_layouts'::regclass,'circuit_venue_links'::regclass)
   limit 1;
  if found then
    raise exception 'Refusing 0034 rollback because relation % depends on canonical venues', dependency.relation_name;
  end if;
end $$;

drop table circuit_venue_links;
drop table venue_layouts;
drop table venues;
drop table venue_kinds;
drop function f5_immutable_machine_key();
delete from schema_migrations where version='0034_f5_canonical_venues';
