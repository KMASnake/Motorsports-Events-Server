do $$ begin
  if exists(select 1 from meetings where timezone is null)
     or exists(select 1 from events where timezone is null) then
    raise exception 'F5-7C rollback refused: canonical timezone NULL data exists';
  end if;
end $$;

alter table meetings alter column timezone set not null;
alter table events alter column timezone set not null;

delete from schema_migrations where version='0040_f5_canonical_timezone_nullability';
