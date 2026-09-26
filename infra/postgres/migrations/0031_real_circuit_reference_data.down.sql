do $$ begin
  if exists(
    select 1 from events e
    join migration_0031_inserted_circuits inserted on inserted.circuit_id=e.circuit_id
  ) then
    raise exception 'Refusing 0031 rollback while an inserted circuit is referenced by an event';
  end if;
end $$;

create temporary table migration_0031_rollback_circuits on commit drop as
select circuit_id from migration_0031_inserted_circuits;

delete from migration_0031_inserted_circuits;
delete from circuits
where id in(select circuit_id from migration_0031_rollback_circuits);

drop table migration_0031_inserted_circuits;
delete from schema_migrations where version='0031_real_circuit_reference_data';
