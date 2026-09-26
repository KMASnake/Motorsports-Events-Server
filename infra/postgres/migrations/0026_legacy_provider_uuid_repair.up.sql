do $$ begin
  if not exists(select 1 from schema_migrations where version='0025_lot57pc_publication_state') then
    raise exception 'Migration 0025_lot57pc_publication_state must be applied first';
  end if;
end $$;

-- Migration 0008 derived UUIDs by casting an MD5 digest directly. PostgreSQL
-- accepts those values, but RFC-aware clients reject digests whose version and
-- variant bits are unset. Keep the digest deterministic while setting UUID v5
-- (character 13) and RFC 4122 variant (character 17) bits explicitly.
create temp table legacy_provider_uuid_map on commit drop as
select id as old_id,
       (substr(hash,1,12)||'5'||substr(hash,14,3)||'8'||substr(hash,18))::uuid as new_id
from provider_instances pi
cross join lateral (
  select md5('mse:legacy-provider:' || lower(btrim(pi.config->>'legacy_provider_key'))) as hash
) digest
where pi.adapter_key='legacy-unresolved'
  and nullif(btrim(pi.config->>'legacy_provider_key'),'') is not null
  and pi.id=md5('mse:legacy-provider:' || lower(btrim(pi.config->>'legacy_provider_key')))::uuid;

create temp table legacy_provider_championship_uuid_map on commit drop as
select pc.id as old_id,
       (substr(hash,1,12)||'5'||substr(hash,14,3)||'8'||substr(hash,18))::uuid as new_id
from provider_championships pc
join championships c on c.id=pc.championship_id
cross join lateral (
  select md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id) as hash
) digest
where nullif(btrim(c.provider_key),'') is not null
  and pc.id=md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id)::uuid;

do $$ begin
  if exists(select 1 from legacy_provider_uuid_map where old_id<>new_id and new_id in (select id from provider_instances)) then
    raise exception 'Refusing legacy provider UUID repair because a target UUID already exists';
  end if;
  if exists(select 1 from legacy_provider_championship_uuid_map where old_id<>new_id and new_id in (select id from provider_championships)) then
    raise exception 'Refusing legacy provider championship UUID repair because a target UUID already exists';
  end if;
end $$;

create temp table legacy_uuid_fk_definitions on commit drop as
select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint
where contype='f'
  and confrelid in ('provider_instances'::regclass,'provider_championships'::regclass);

do $$ declare fk record; cascade_definition text; begin
  for fk in select * from legacy_uuid_fk_definitions loop
    cascade_definition := case
      when fk.definition like '% ON DELETE %'
        then replace(fk.definition,' ON DELETE ',' ON UPDATE CASCADE ON DELETE ')
      else fk.definition || ' ON UPDATE CASCADE'
    end;
    execute format('alter table %s drop constraint %I',fk.table_name,fk.conname);
    execute format('alter table %s add constraint %I %s',fk.table_name,fk.conname,cascade_definition);
  end loop;
end $$;

update provider_instances pi set id=m.new_id
from legacy_provider_uuid_map m where pi.id=m.old_id and m.old_id<>m.new_id;

update provider_championships pc set id=m.new_id
from legacy_provider_championship_uuid_map m where pc.id=m.old_id and m.old_id<>m.new_id;

do $$ declare fk record; begin
  for fk in select * from legacy_uuid_fk_definitions loop
    execute format('alter table %s drop constraint %I',fk.table_name,fk.conname);
    execute format('alter table %s add constraint %I %s',fk.table_name,fk.conname,fk.definition);
  end loop;
end $$;

insert into schema_migrations(version)
values('0026_legacy_provider_uuid_repair') on conflict do nothing;
