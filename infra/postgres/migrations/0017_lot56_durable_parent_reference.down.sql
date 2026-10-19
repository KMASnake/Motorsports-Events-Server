do $$
begin
  if exists(select 1 from provider_source_entities where parent_external_id is not null)
     and current_setting('mse.allow_destructive_lot56_rollback',true) is distinct from 'on' then
    raise exception '0017 rollback would discard durable parent references; use a disposable database or explicitly enable mse.allow_destructive_lot56_rollback';
  end if;
end $$;

drop index provider_source_entities_parent_reference_idx;
alter table provider_source_entities
  drop constraint provider_source_entities_parent_reference_complete_ck,
  drop column parent_entity_kind,
  drop column parent_external_id;

delete from schema_migrations where version='0017_lot56_durable_parent_reference';
