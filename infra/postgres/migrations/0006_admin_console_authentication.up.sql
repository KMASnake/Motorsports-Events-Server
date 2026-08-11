do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0005_event_session_title'
  ) then
    raise exception 'Migration 0005_event_session_title must be applied first';
  end if;
end $$;

create table if not exists admin_accounts (
  id uuid primary key,
  singleton_key boolean not null default true unique,
  username text not null,
  username_normalized text not null unique,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  password_changed_at timestamptz not null default now(),
  constraint admin_accounts_singleton_true check (singleton_key),
  constraint admin_accounts_username_not_blank check (btrim(username) <> ''),
  constraint admin_accounts_username_normalized_not_blank check (btrim(username_normalized) <> ''),
  constraint admin_accounts_password_hash_not_blank check (btrim(password_hash) <> '')
);

create table if not exists admin_login_guard (
  singleton_key boolean primary key default true,
  failed_attempts integer not null default 0,
  window_started_at timestamptz,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_login_guard_singleton_true check (singleton_key),
  constraint admin_login_guard_failed_attempts_nonnegative check (failed_attempts >= 0)
);

create table if not exists admin_sessions (
  id uuid primary key,
  admin_account_id uuid not null references admin_accounts(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null,
  last_seen_at timestamptz not null,
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint admin_sessions_token_hash_length check (octet_length(token_hash) = 32),
  constraint admin_sessions_last_seen_range check (
    last_seen_at >= created_at and last_seen_at <= absolute_expires_at
  ),
  constraint admin_sessions_idle_range check (
    idle_expires_at >= created_at and idle_expires_at <= absolute_expires_at
  ),
  constraint admin_sessions_absolute_after_creation check (absolute_expires_at > created_at)
);

create index if not exists admin_sessions_account_idx
  on admin_sessions(admin_account_id);
create index if not exists admin_sessions_active_idle_expiry_idx
  on admin_sessions(idle_expires_at) where revoked_at is null;
create index if not exists admin_sessions_absolute_expiry_idx
  on admin_sessions(absolute_expires_at);

insert into schema_migrations(version)
values ('0006_admin_console_authentication')
on conflict do nothing;
