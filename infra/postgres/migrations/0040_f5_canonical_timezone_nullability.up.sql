do $$ begin
  if not exists(select 1 from schema_migrations where version='0039_f5_confirmed_event_status') then
    raise exception 'Migration 0039_f5_confirmed_event_status must be applied first';
  end if;
end $$;

alter table meetings alter column timezone drop not null;
alter table events alter column timezone drop not null;

insert into schema_migrations(version) values('0040_f5_canonical_timezone_nullability');
