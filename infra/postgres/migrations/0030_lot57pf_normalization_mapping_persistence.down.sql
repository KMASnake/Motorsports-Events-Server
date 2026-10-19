do $$ begin
  if exists(select 1 from provider_championship_active_normalization_mappings)
     or exists(select 1 from provider_acquisition_traversal_mappings)
     or exists(select 1 from normalization_mapping_versions) then
    raise exception 'Refusing destructive 0030 rollback while normalization mapping data exists';
  end if;
end $$;

drop trigger provider_acquisition_traversal_mappings_immutable on provider_acquisition_traversal_mappings;
drop function reject_provider_acquisition_traversal_mapping_mutation();
drop trigger normalization_mapping_versions_protect_used_delete on normalization_mapping_versions;
drop function protect_used_normalization_mapping_version_delete();
drop trigger normalization_mapping_versions_immutable_update on normalization_mapping_versions;
drop function reject_normalization_mapping_version_update();
drop trigger provider_acquisition_traversal_mappings_validate on provider_acquisition_traversal_mappings;
drop function validate_provider_acquisition_traversal_mapping();
drop table provider_acquisition_traversal_mappings;
drop table provider_championship_active_normalization_mappings;
drop trigger normalization_mapping_versions_validate on normalization_mapping_versions;
drop function validate_normalization_mapping_document();
drop table normalization_mapping_versions;

delete from schema_migrations where version='0030_lot57pf_normalization_mapping_persistence';
