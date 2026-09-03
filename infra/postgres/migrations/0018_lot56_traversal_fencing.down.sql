drop index provider_acquisition_traversals_ownership_idx;
alter table provider_acquisition_traversals
  drop constraint provider_acquisition_traversals_lease_generation_ck,
  drop column lease_generation;

delete from schema_migrations where version='0018_lot56_traversal_fencing';
