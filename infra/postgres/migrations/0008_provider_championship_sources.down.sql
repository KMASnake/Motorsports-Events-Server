do $$
begin
  if exists (select 1 from provider_championship_source_configs) then
    raise exception 'Refusing to remove source configurations; export and clean them first';
  end if;

  if exists (
    select 1
    from provider_championships pc
    join provider_instances pi on pi.id = pc.provider_instance_id
    join championships c on c.id = pc.championship_id
    where pi.adapter_key <> 'legacy-unresolved'
       or pi.id <> md5('mse:legacy-provider:' || lower(btrim(c.provider_key)))::uuid
       or pc.id <> md5('mse:legacy-provider-championship:' || lower(btrim(c.provider_key)) || ':' || c.id)::uuid
       or pc.discovery_state <> 'manual'
       or pc.sync_state <> 'inactive'
       or pc.is_primary
       or pc.start_year is not null
       or pc.external_championship_id is distinct from nullif(btrim(c.external_id), '')
  ) then
    raise exception 'Refusing to remove provider championship data that is not an untouched legacy backfill';
  end if;
end $$;

delete from provider_championships pc
using provider_instances pi
where pc.provider_instance_id = pi.id
  and pi.adapter_key = 'legacy-unresolved';

delete from provider_instances pi
where pi.adapter_key = 'legacy-unresolved'
  and not exists (
    select 1 from provider_championships pc
    where pc.provider_instance_id = pi.id
  );

drop index if exists provider_championships_championship_idx;
drop index if exists provider_championships_provider_state_idx;
drop index if exists provider_championships_one_active_primary_idx;
drop table provider_championship_source_configs;
drop table provider_championships;
delete from schema_migrations where version = '0008_provider_championship_sources';
