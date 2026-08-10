drop index if exists events_provider_identity_unique;
drop table if exists admin_audit_log;
delete from schema_migrations where version = '0003_admin_audit_and_provider_identity';
