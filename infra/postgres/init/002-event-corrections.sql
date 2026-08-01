create table if not exists event_corrections (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  provider_key text not null,
  external_id text,
  field_name text not null,
  provider_value jsonb,
  override_value jsonb,
  status text not null default 'active' check(status in ('active','conflict','resolved','ignored')),
  created_by text not null default 'administrator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_provider_seen_at timestamptz,
  conflict_detected_at timestamptz,
  unique(event_id, field_name)
);

create index if not exists event_corrections_event_idx on event_corrections(event_id);
create index if not exists event_corrections_status_idx on event_corrections(status);
