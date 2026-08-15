alter table provider_source_entities
  add column parent_external_id text,
  add column parent_entity_kind text;

update provider_source_entities child
set parent_external_id=parent.external_id,
    parent_entity_kind=parent.entity_kind
from provider_source_entities parent
where parent.id=child.parent_source_entity_id;

alter table provider_source_entities
  add constraint provider_source_entities_parent_reference_complete_ck
    check ((parent_external_id is null and parent_entity_kind is null)
      or (parent_external_id is not null and btrim(parent_external_id)<>''
        and length(parent_external_id)<=512
        and parent_entity_kind in ('meeting','event','session')));

create index provider_source_entities_parent_reference_idx
  on provider_source_entities(provider_championship_id,parent_entity_kind,parent_external_id)
  where parent_external_id is not null;
