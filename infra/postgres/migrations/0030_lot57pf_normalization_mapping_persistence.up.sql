do $$ begin
  if not exists(select 1 from schema_migrations where version='0029_lot57pe_canonical_championship_entitlements') then
    raise exception 'Migration 0029_lot57pe_canonical_championship_entitlements must be applied first';
  end if;
end $$;

create table normalization_mapping_versions (
  id uuid primary key,
  provider_championship_id uuid not null references provider_championships(id) on delete restrict,
  version_label text not null check(btrim(version_label)<>'' and length(version_label)<=128),
  rules_version text not null check(btrim(rules_version)<>'' and length(rules_version)<=128),
  mapping_document jsonb not null check(jsonb_typeof(mapping_document)='object'),
  created_at timestamptz not null default now(),
  created_by text not null check(btrim(created_by)<>'' and length(created_by)<=256),
  constraint normalization_mapping_versions_document_size check(octet_length(mapping_document::text)<=262144),
  unique(provider_championship_id,version_label),
  unique(id,provider_championship_id)
);
create index normalization_mapping_versions_owner_created_idx
  on normalization_mapping_versions(provider_championship_id,created_at desc);

create function validate_normalization_mapping_document() returns trigger
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
      elsif section_name='sessionTypes' and (pair.value#>>'{}')<>all(array['practice','qualifying','sprint_qualifying','sprint','race','other']) then
        raise exception 'Invalid canonical session type %',pair.value#>>'{}';
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
create trigger normalization_mapping_versions_validate
before insert on normalization_mapping_versions
for each row execute function validate_normalization_mapping_document();

create table provider_championship_active_normalization_mappings (
  provider_championship_id uuid primary key references provider_championships(id) on delete restrict,
  mapping_version_id uuid not null,
  activated_at timestamptz not null,
  activated_by text not null check(btrim(activated_by)<>'' and length(activated_by)<=256),
  constraint provider_championship_active_mapping_owner_fk
    foreign key(mapping_version_id,provider_championship_id)
    references normalization_mapping_versions(id,provider_championship_id) on delete restrict
);

create table provider_acquisition_traversal_mappings (
  traversal_id uuid primary key references provider_acquisition_traversals(id) on delete restrict,
  provider_championship_id uuid not null references provider_championships(id) on delete restrict,
  mapping_version_id uuid not null,
  bound_at timestamptz not null default now(),
  constraint provider_acquisition_traversal_mapping_owner_fk
    foreign key(mapping_version_id,provider_championship_id)
    references normalization_mapping_versions(id,provider_championship_id) on delete restrict
);
create index provider_acquisition_traversal_mappings_version_idx
  on provider_acquisition_traversal_mappings(mapping_version_id,traversal_id);

create function validate_provider_acquisition_traversal_mapping() returns trigger
language plpgsql as $$
declare traversal_owner uuid;
begin
  select stream.provider_championship_id into traversal_owner
    from provider_acquisition_traversals traversal
    join sync_streams stream on stream.id=traversal.stream_id
    where traversal.id=new.traversal_id;
  if traversal_owner is distinct from new.provider_championship_id then
    raise exception 'Traversal and normalization mapping must share the same provider championship';
  end if;
  return new;
end $$;
create trigger provider_acquisition_traversal_mappings_validate
before insert on provider_acquisition_traversal_mappings
for each row execute function validate_provider_acquisition_traversal_mapping();

create function reject_normalization_mapping_version_update() returns trigger
language plpgsql as $$ begin
  raise exception 'Normalization mapping versions are immutable';
end $$;
create trigger normalization_mapping_versions_immutable_update
before update on normalization_mapping_versions
for each row execute function reject_normalization_mapping_version_update();

create function protect_used_normalization_mapping_version_delete() returns trigger
language plpgsql as $$ begin
  if exists(select 1 from provider_championship_active_normalization_mappings where mapping_version_id=old.id)
     or exists(select 1 from provider_acquisition_traversal_mappings where mapping_version_id=old.id) then
    raise exception 'Active or traversal-bound normalization mapping versions cannot be deleted';
  end if;
  return old;
end $$;
create trigger normalization_mapping_versions_protect_used_delete
before delete on normalization_mapping_versions
for each row execute function protect_used_normalization_mapping_version_delete();

create function reject_provider_acquisition_traversal_mapping_mutation() returns trigger
language plpgsql as $$ begin
  raise exception 'Traversal normalization mapping bindings are immutable';
end $$;
create trigger provider_acquisition_traversal_mappings_immutable
before update or delete on provider_acquisition_traversal_mappings
for each row execute function reject_provider_acquisition_traversal_mapping_mutation();

insert into schema_migrations(version)
values('0030_lot57pf_normalization_mapping_persistence');
