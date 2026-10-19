do $$ begin
  if not exists(select 1 from schema_migrations where version='0038_f5_canonical_publication') then
    raise exception 'Migration 0038_f5_canonical_publication must be applied first';
  end if;
end $$;

alter table events drop constraint events_status_check;
alter table events add constraint events_status_check
  check(status in ('draft','scheduled','confirmed','completed','cancelled','postponed'));

insert into schema_migrations(version) values('0039_f5_confirmed_event_status');
