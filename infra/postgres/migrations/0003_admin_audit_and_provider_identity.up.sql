create table if not exists admin_audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on admin_audit_log(created_at desc);
create index if not exists admin_audit_resource_idx on admin_audit_log(resource_type,resource_id);
create unique index if not exists events_provider_identity_unique
  on events(provider_key, external_id)
  where provider_key is not null and external_id is not null;
insert into schema_migrations(version) values ('0003_admin_audit_and_provider_identity') on conflict do nothing;
