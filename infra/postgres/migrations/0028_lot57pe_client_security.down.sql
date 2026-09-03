do $$ begin
  if exists(select 1 from api_client_daily_usage where request_count>0)
     or exists(select 1 from api_client_minute_usage where request_count>0)
     or exists(select 1 from api_keys)
     or exists(select 1 from api_clients) then
    raise exception 'Refusing destructive 0028 rollback while client security data exists';
  end if;
end $$;

drop table api_client_daily_usage;
drop table api_client_minute_usage;
drop table api_client_championships;
drop table api_client_scopes;
drop table api_keys;
drop table api_clients;
delete from schema_migrations where version='0028_lot57pe_client_security';
