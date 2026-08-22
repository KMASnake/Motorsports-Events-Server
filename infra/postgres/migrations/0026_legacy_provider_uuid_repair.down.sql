create temp table legacy_provider_uuid_map on commit drop as
select id as new_id,
       md5('mse:legacy-provider:' || lower(btrim(config->>'legacy_provider_key')))::uuid as old_id
from provider_instances
where adapter_key='legacy-unresolved'
  and nullif(btrim(config->>'legacy_provider_key'),'') is not null
  and id=(
    substr(md5('mse:legacy-provider:' || lower(btrim(config->>'legacy_provider_key'))),1,12)||'5'||
    substr(md5('mse:legacy-provider:' || lower(btrim(config->>'legacy_provider_key'))),14,3)||'8'||
    substr(md5('mse:legacy-provider:' || lower(btrim(config->>'legacy_provider_key'))),18)
  )::uuid;

create temp table legacy_provider_championship_uuid_map on commit drop as
select pc.id as new_id,
       md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id)::uuid as old_id
from provider_championships pc
join championships c on c.id=pc.championship_id
where nullif(btrim(c.provider_key),'') is not null
  and pc.id=(
    substr(md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id),1,12)||'5'||
    substr(md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id),14,3)||'8'||
    substr(md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id),18)
  )::uuid;

do $$ begin
  if exists(select 1 from legacy_provider_uuid_map where old_id<>new_id and old_id in (select id from provider_instances)) then
    raise exception 'Refusing rollback because a historical provider UUID already exists';
  end if;
  if exists(select 1 from legacy_provider_championship_uuid_map where old_id<>new_id and old_id in (select id from provider_championships)) then
    raise exception 'Refusing rollback because a historical provider championship UUID already exists';
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

update provider_championships pc set id=m.old_id
from legacy_provider_championship_uuid_map m where pc.id=m.new_id and m.old_id<>m.new_id;

update provider_instances pi set id=m.old_id
from legacy_provider_uuid_map m where pi.id=m.new_id and m.old_id<>m.new_id;

do $$ declare fk record; begin
  for fk in select * from legacy_uuid_fk_definitions loop
    execute format('alter table %s drop constraint %I',fk.table_name,fk.conname);
    execute format('alter table %s add constraint %I %s',fk.table_name,fk.conname,fk.definition);
  end loop;
end $$;

delete from schema_migrations where version='0026_legacy_provider_uuid_repair';
