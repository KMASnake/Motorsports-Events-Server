do $$
begin
  if exists (
    select 1 from events
    where nullif(btrim(session_title), '') is not null
  ) then
    raise exception 'Refusing to drop events.session_title while values remain';
  end if;
end $$;

alter table events drop column session_title;
delete from schema_migrations where version = '0005_event_session_title';
