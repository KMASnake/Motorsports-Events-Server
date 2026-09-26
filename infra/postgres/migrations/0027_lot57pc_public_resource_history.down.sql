drop trigger public_resource_versions_immutable on public_resource_versions;
drop function reject_public_resource_version_mutation();
drop table public_resource_versions;
delete from public_change_log
where sequence in (select unnest(baseline_generated_sequences) from public_history_controls where singleton=true);
drop table public_history_controls;
delete from schema_migrations where version='0027_lot57pc_public_resource_history';
