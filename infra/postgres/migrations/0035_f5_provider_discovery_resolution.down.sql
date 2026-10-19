do $$
declare dependency record;
begin
  if exists(select 1 from championship_discovery_decisions)
    or exists(select 1 from championship_discovery_candidates)
    or exists(select 1 from championship_season_source_links)
    or exists(select 1 from championship_source_links)
    or exists(select 1 from provider_discovery_observations) then
    raise exception 'Refusing 0035 rollback while F5-4 discovery data exists';
  end if;
  select conrelid::regclass::text as relation_name into dependency
    from pg_constraint
   where contype='f'
     and confrelid in (
       'provider_discovery_observations'::regclass,
       'championship_source_links'::regclass,
       'championship_season_source_links'::regclass,
       'championship_discovery_candidates'::regclass,
       'championship_discovery_decisions'::regclass
     )
     and conrelid not in (
       'provider_discovery_observations'::regclass,
       'championship_source_links'::regclass,
       'championship_season_source_links'::regclass,
       'championship_discovery_candidates'::regclass,
       'championship_discovery_decisions'::regclass
     )
   limit 1;
  if found then
    raise exception 'Refusing 0035 rollback because relation % depends on F5-4 discovery',dependency.relation_name;
  end if;
end $$;

drop table championship_discovery_decisions;
drop table championship_discovery_candidates;
drop table championship_season_source_links;
drop table championship_source_links;
drop table provider_discovery_observations;
drop function f5_discovery_reject_mutation();
alter table provider_discovery_runs drop constraint provider_discovery_runs_id_provider_unique;
delete from schema_migrations where version='0035_f5_provider_discovery_resolution';
