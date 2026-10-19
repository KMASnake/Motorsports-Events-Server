do $$ begin
  if exists(select 1 from events where status='confirmed') then
    raise exception 'F5-7C rollback refused: confirmed Event data exists';
  end if;
end $$;

alter table events drop constraint events_status_check;
alter table events add constraint events_status_check
  check(status in ('draft','scheduled','completed','cancelled','postponed'));

delete from schema_migrations where version='0039_f5_confirmed_event_status';
