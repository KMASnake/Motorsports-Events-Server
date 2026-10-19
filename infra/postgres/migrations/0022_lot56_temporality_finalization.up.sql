alter table provider_source_entities
  add column end_estimation_details jsonb not null default '{}'::jsonb
    check(jsonb_typeof(end_estimation_details)='object')
    check(octet_length(end_estimation_details::text) <= 8192);

insert into schema_migrations(version)
values('0022_lot56_temporality_finalization') on conflict do nothing;
