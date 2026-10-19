do $$ begin
  if not exists(select 1 from schema_migrations where version='0041_f5_revisioned_normalization_decisions') then
    raise exception 'Migration 0041_f5_revisioned_normalization_decisions must be applied first';
  end if;
end $$;

create table provider_acquisition_retry_units (
  id uuid primary key,
  provider_instance_id uuid not null references provider_instances(id) on delete cascade,
  stream_id uuid not null references sync_streams(id) on delete cascade,
  traversal_id uuid not null references provider_acquisition_traversals(id) on delete cascade,
  logical_unit_key text not null check(logical_unit_key ~ '^[a-f0-9]{64}$'),
  state text not null default 'ready' check(state in
    ('ready','retry_wait','quota_wait','paused','permanent_failure','auth_failure','exhausted','succeeded')),
  emitted_attempt_count integer not null default 0,
  max_emitted_attempts integer not null default 5 check(max_emitted_attempts=5),
  policy_version text not null default 'acquisition_retry_v1' check(policy_version='acquisition_retry_v1'),
  next_retry_at timestamptz,
  local_backoff_until timestamptz,
  quota_deadline timestamptz,
  failure_category text,
  failure_code text check(length(failure_code)<=80),
  http_status integer check(http_status between 100 and 599),
  retry_after_state text check(retry_after_state in ('missing','invalid','past','valid')),
  retry_after_at timestamptz,
  last_charge_id uuid references provider_request_charges(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(traversal_id,logical_unit_key),
  check(emitted_attempt_count between 0 and max_emitted_attempts),
  check(state not in ('permanent_failure','auth_failure','exhausted','paused','succeeded') or next_retry_at is null),
  check(state<>'exhausted' or emitted_attempt_count=max_emitted_attempts)
);
-- This is an idempotency/reservation link to the sovereign quota ledger,
-- not a second request or quota ledger. Unsettled reservations fail closed.
create table provider_acquisition_retry_charges (
  charge_id uuid primary key references provider_request_charges(id) on delete cascade,
  retry_unit_id uuid not null references provider_acquisition_retry_units(id) on delete cascade,
  counted boolean not null default false,
  emission_disposition text not null default 'indeterminate'
    check(emission_disposition in ('indeterminate','confirmed_not_emitted','confirmed_emitted')),
  disposition_evidence_reference text check(disposition_evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'),
  disposed_at timestamptz,
  check(counted = (emission_disposition='confirmed_emitted')),
  check((disposition_evidence_reference is null) = (disposed_at is null)),
  check(disposition_evidence_reference is null or emission_disposition<>'indeterminate')
);
create index provider_acquisition_retry_charges_unit_idx
  on provider_acquisition_retry_charges(retry_unit_id);
create index provider_acquisition_retry_units_stream_idx
  on provider_acquisition_retry_units(stream_id,traversal_id);
insert into schema_migrations(version) values('0042_acquisition_retry_state');
