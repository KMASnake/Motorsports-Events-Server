do $$ declare table_name text; begin
  foreach table_name in array array['sessions','refresh_tokens','api_keys','webhooks','notifications','audit_logs','users'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('truncate table %I cascade', table_name);
    end if;
  end loop;
end $$;

update championships set provider_key=null, external_id=null where provider_key is not null;
update events set provider_key=null, external_id=null, origin='manual' where provider_key is not null or external_id is not null;
truncate table event_corrections;
