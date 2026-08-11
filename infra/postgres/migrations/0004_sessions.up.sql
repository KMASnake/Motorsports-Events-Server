create table if not exists session_types (
  key text primary key,
  label text not null,
  sort_order integer not null,
  active boolean not null default true
);

insert into session_types(key, label, sort_order, active) values
  ('practice', 'Essais', 1, true),
  ('qualifying', 'Qualifications', 2, true),
  ('sprint', 'Sprint', 3, true),
  ('warmup', 'Warm-up', 4, true),
  ('race', 'Course', 5, true),
  ('other', 'Autre', 6, true)
on conflict (key) do nothing;

create table if not exists sessions (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  name text not null,
  type text not null references session_types(key) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled'
    check(status in ('draft','scheduled','completed','cancelled','postponed')),
  published boolean not null default true,
  description text,
  origin text not null default 'manual'
    check(origin in ('manual','provider','import','mixed')),
  provider_key text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at >= starts_at)
);

create index if not exists sessions_event_starts_id_idx
  on sessions(event_id, starts_at, id);
create unique index if not exists sessions_provider_identity_unique
  on sessions(provider_key, external_id)
  where provider_key is not null and external_id is not null;

create table if not exists session_corrections (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  provider_key text not null,
  external_id text,
  field_name text not null,
  provider_value jsonb,
  override_value jsonb,
  status text not null default 'active'
    check(status in ('active','conflict','resolved','ignored')),
  created_by text not null default 'administrator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_provider_seen_at timestamptz,
  conflict_detected_at timestamptz,
  unique(session_id, field_name)
);

create index if not exists session_corrections_session_idx
  on session_corrections(session_id);
create index if not exists session_corrections_status_idx
  on session_corrections(status);

insert into schema_migrations(version)
values ('0004_sessions')
on conflict do nothing;
