do $$ begin
  if exists(select 1 from championships where discipline_key is not null) then
    raise exception 'Refusing 0032 rollback while championships use canonical disciplines';
  end if;
  if exists(select 1 from disciplines where (key,label,family_key,active) not in (values
    ('single_seater','Monoplace','circuit_racing',true),
    ('motorcycle_racing','Vitesse moto','circuit_racing',true),
    ('rally','Rallye','rally',true),
    ('endurance','Endurance','circuit_racing',true)
  )) then
    raise exception 'Refusing 0032 rollback while disciplines contain custom data';
  end if;
  if exists(select 1 from discipline_families where (key,label,active) not in (values
    ('circuit_racing','Compétition sur circuit',true),
    ('rally','Rallye',true)
  )) then
    raise exception 'Refusing 0032 rollback while discipline families contain custom data';
  end if;
  if exists(
    select 1 from normalization_mapping_versions version,
      lateral jsonb_each_text(version.mapping_document->'sessionTypes') mapped
    where mapped.value in ('practice_1','practice_2','practice_3','test','stage','special_stage')
  ) then
    raise exception 'Refusing 0032 rollback while mappings use F5 session types';
  end if;
  if exists(select 1 from sessions where type in ('practice_1','practice_2','practice_3','sprint_qualifying','test','stage','special_stage')) then
    raise exception 'Refusing 0032 rollback while historical sessions use F5 session types';
  end if;
  if exists(select 1 from events where category in ('practice_1','practice_2','practice_3','sprint_qualifying','test','stage','special_stage')) then
    raise exception 'Refusing 0032 rollback while canonical Events use F5 session types';
  end if;
  if exists(select 1 from session_types where key in ('practice_1','practice_2','practice_3','sprint_qualifying','test','stage','special_stage') and (key,label,sort_order,active) not in (values
    ('practice_1','Essais libres 1',11,true),
    ('practice_2','Essais libres 2',12,true),
    ('practice_3','Essais libres 3',13,true),
    ('sprint_qualifying','Qualifications sprint',21,true),
    ('test','Essais privés',40,true),
    ('stage','Étape',50,true),
    ('special_stage','Épreuve spéciale',51,true)
  )) then
    raise exception 'Refusing 0032 rollback while F5 session types contain custom data';
  end if;
end $$;

delete from session_types
where key in ('practice_1','practice_2','practice_3','sprint_qualifying','test','stage','special_stage');

alter table championships drop constraint championships_discipline_fk;
drop index championships_discipline_idx;
alter table championships drop column discipline_key;
drop table disciplines;
drop table discipline_families;

-- Restore the pre-F5 closed validation only for an explicitly requested rollback.
create or replace function validate_normalization_mapping_document() returns trigger
language plpgsql as $$
declare
  section_name text;
  pair record;
  owner_external_id text;
  owner_championship_id text;
  entry_limit integer;
begin
  if (select count(*) from jsonb_object_keys(new.mapping_document))<>4
     or not new.mapping_document ?& array['championshipIds','circuitIds','sessionTypes','statuses'] then
    raise exception 'Normalization mapping document must contain exactly championshipIds, circuitIds, sessionTypes and statuses';
  end if;
  foreach section_name in array array['championshipIds','circuitIds','sessionTypes','statuses'] loop
    if jsonb_typeof(new.mapping_document->section_name)<>'object' then raise exception 'Normalization mapping section % must be an object',section_name; end if;
    entry_limit:=case section_name when 'championshipIds' then 16 when 'circuitIds' then 2000 else 256 end;
    if (select count(*) from jsonb_object_keys(new.mapping_document->section_name))>entry_limit then raise exception 'Normalization mapping section % exceeds its entry limit',section_name; end if;
    for pair in select key,value from jsonb_each(new.mapping_document->section_name) loop
      if btrim(pair.key)='' or length(pair.key)>256 or jsonb_typeof(pair.value)<>'string' or btrim(pair.value#>>'{}')='' or length(pair.value#>>'{}')>256 then raise exception 'Normalization mapping section % contains an invalid string mapping',section_name; end if;
      if section_name='championshipIds' and not exists(select 1 from championships where id=pair.value#>>'{}') then raise exception 'Unknown canonical championship mapping target %',pair.value#>>'{}';
      elsif section_name='circuitIds' and not exists(select 1 from circuits where id=pair.value#>>'{}') then raise exception 'Unknown canonical circuit mapping target %',pair.value#>>'{}';
      elsif section_name='sessionTypes' and (pair.value#>>'{}')<>all(array['practice','qualifying','sprint_qualifying','sprint','race','other']) then raise exception 'Invalid canonical session type %',pair.value#>>'{}';
      elsif section_name='statuses' and (pair.value#>>'{}')<>all(array['scheduled','confirmed','postponed','cancelled','completed']) then raise exception 'Invalid canonical status %',pair.value#>>'{}'; end if;
    end loop;
  end loop;
  select external_championship_id,championship_id into owner_external_id,owner_championship_id from provider_championships where id=new.provider_championship_id;
  if owner_external_id is null or new.mapping_document->'championshipIds'->>owner_external_id is distinct from owner_championship_id then raise exception 'Mapping must map the owning external championship to its canonical championship'; end if;
  return new;
end $$;

delete from schema_migrations where version='0032_f5_canonical_taxonomy';
