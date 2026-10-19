do $$ begin
  if not exists(select 1 from schema_migrations where version='0031_real_circuit_reference_data') then
    raise exception 'Migration 0031_real_circuit_reference_data must be applied first';
  end if;
end $$;

create table discipline_families (
  key text primary key check(key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$' and length(key)<=64),
  label text not null check(btrim(label)<>'' and length(label)<=120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into discipline_families(key,label,active) values
  ('circuit_racing','Compétition sur circuit',true),
  ('rally','Rallye',true)
on conflict(key) do nothing;

create table disciplines (
  key text primary key check(key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$' and length(key)<=64),
  label text not null check(btrim(label)<>'' and length(label)<=120),
  family_key text not null references discipline_families(key) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into disciplines(key,label,family_key,active) values
  ('single_seater','Monoplace','circuit_racing',true),
  ('motorcycle_racing','Vitesse moto','circuit_racing',true),
  ('rally','Rallye','rally',true),
  ('endurance','Endurance','circuit_racing',true)
on conflict(key) do nothing;

alter table championships add column discipline_key text;
alter table championships add constraint championships_discipline_fk
  foreign key(discipline_key) references disciplines(key) on delete restrict;
create index championships_discipline_idx on championships(discipline_key) where discipline_key is not null;

insert into session_types(key,label,sort_order,active) values
  ('practice_1','Essais libres 1',11,true),
  ('practice_2','Essais libres 2',12,true),
  ('practice_3','Essais libres 3',13,true),
  ('sprint_qualifying','Qualifications sprint',21,true),
  ('test','Essais privés',40,true),
  ('stage','Étape',50,true),
  ('special_stage','Épreuve spéciale',51,true)
on conflict(key) do nothing;

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
    if jsonb_typeof(new.mapping_document->section_name)<>'object' then
      raise exception 'Normalization mapping section % must be an object',section_name;
    end if;
    entry_limit:=case section_name when 'championshipIds' then 16 when 'circuitIds' then 2000 else 256 end;
    if (select count(*) from jsonb_object_keys(new.mapping_document->section_name))>entry_limit then
      raise exception 'Normalization mapping section % exceeds its entry limit',section_name;
    end if;
    for pair in select key,value from jsonb_each(new.mapping_document->section_name) loop
      if btrim(pair.key)='' or length(pair.key)>256 or jsonb_typeof(pair.value)<>'string'
         or btrim(pair.value#>>'{}')='' or length(pair.value#>>'{}')>256 then
        raise exception 'Normalization mapping section % contains an invalid string mapping',section_name;
      end if;
      if section_name='championshipIds' and not exists(select 1 from championships where id=pair.value#>>'{}') then
        raise exception 'Unknown canonical championship mapping target %',pair.value#>>'{}';
      elsif section_name='circuitIds' and not exists(select 1 from circuits where id=pair.value#>>'{}') then
        raise exception 'Unknown canonical circuit mapping target %',pair.value#>>'{}';
      elsif section_name='sessionTypes' and not exists(select 1 from session_types where key=pair.value#>>'{}') then
        raise exception 'Unknown canonical session type %',pair.value#>>'{}';
      elsif section_name='statuses' and (pair.value#>>'{}')<>all(array['scheduled','confirmed','postponed','cancelled','completed']) then
        raise exception 'Invalid canonical status %',pair.value#>>'{}';
      end if;
    end loop;
  end loop;

  select external_championship_id,championship_id into owner_external_id,owner_championship_id
    from provider_championships where id=new.provider_championship_id;
  if owner_external_id is null
     or new.mapping_document->'championshipIds'->>owner_external_id is distinct from owner_championship_id then
    raise exception 'Mapping must map the owning external championship to its canonical championship';
  end if;
  return new;
end $$;

insert into schema_migrations(version) values('0032_f5_canonical_taxonomy');
