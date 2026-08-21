alter table provider_source_entities drop column end_estimation_details;

delete from schema_migrations where version='0022_lot56_temporality_finalization';
