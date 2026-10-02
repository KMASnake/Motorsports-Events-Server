do $$ begin
  if exists(
    select 1 from api_client_championships
    where championship_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Refusing 0029 rollback: canonical text championship entitlements cannot be represented as UUID';
  end if;
end $$;

alter table api_client_championships
  drop constraint api_client_championships_championship_fk;

alter table api_client_championships
  drop constraint api_client_championships_canonical_id_check;

alter table api_client_championships
  alter column championship_id type uuid using championship_id::uuid;

delete from schema_migrations
where version='0029_lot57pe_canonical_championship_entitlements';
