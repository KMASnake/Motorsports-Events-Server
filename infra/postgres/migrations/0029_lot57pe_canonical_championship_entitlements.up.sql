do $$ begin
  if not exists(select 1 from schema_migrations where version='0028_lot57pe_client_security') then
    raise exception 'Migration 0028_lot57pe_client_security must be applied first';
  end if;
end $$;

alter table api_client_championships
  alter column championship_id type text using championship_id::text;

alter table api_client_championships
  add constraint api_client_championships_canonical_id_check check(
    championship_id=btrim(championship_id)
    and length(championship_id) between 1 and 160
    and championship_id ~ '^[A-Za-z0-9]+([._:-][A-Za-z0-9]+)*$'
  );

-- Preserve any legacy UUID entitlement while enforcing canonical IDs for all
-- new writes. A later audited cleanup may validate the historical rows.
alter table api_client_championships
  add constraint api_client_championships_championship_fk
  foreign key(championship_id) references championships(id) on delete restrict
  not valid;

insert into schema_migrations(version)
values('0029_lot57pe_canonical_championship_entitlements');
