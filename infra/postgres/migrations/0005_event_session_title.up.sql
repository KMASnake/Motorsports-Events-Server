do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0004_sessions'
  ) then
    raise exception 'Migration 0004_sessions must be applied first';
  end if;
end $$;

alter table events
  add column if not exists session_title text;

insert into schema_migrations(version)
values ('0005_event_session_title')
on conflict do nothing;
