do $$ begin
  if not exists(select 1 from schema_migrations where version='0027_lot57pc_public_resource_history') then
    raise exception 'Migration 0027_lot57pc_public_resource_history must be applied first';
  end if;
end $$;

create table api_clients (
  id uuid primary key,
  name text not null check(btrim(name)<>'' and length(name)<=160),
  status text not null default 'active' check(status in ('active','suspended','closed')),
  rate_limit_per_minute integer not null default 60 check(rate_limit_per_minute between 1 and 100000),
  daily_quota integer not null default 10000 check(daily_quota between 1 and 100000000),
  page_limit integer not null default 100 check(page_limit between 1 and 100),
  changes_page_limit integer not null default 500 check(changes_page_limit between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key,
  client_id uuid not null references api_clients(id) on delete restrict,
  environment text not null check(environment in ('live','test')),
  name text not null check(btrim(name)<>'' and length(name)<=160),
  key_prefix text not null unique check(key_prefix ~ '^[A-Za-z0-9_-]{12,32}$'),
  key_digest text not null check(key_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check(status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_client_active_idx on api_keys(client_id,id) where status='active';

create table api_client_scopes (
  client_id uuid not null references api_clients(id) on delete cascade,
  scope text not null check(scope in ('championships:read','events:read','meetings:read','changes:read')),
  primary key(client_id,scope)
);

create table api_client_championships (
  client_id uuid not null references api_clients(id) on delete cascade,
  championship_id uuid not null,
  primary key(client_id,championship_id)
);

create table api_client_minute_usage (
  client_id uuid not null references api_clients(id) on delete cascade,
  minute_start timestamptz not null,
  request_count integer not null check(request_count>=0),
  primary key(client_id,minute_start),
  check(minute_start=date_trunc('minute',minute_start))
);

create table api_client_daily_usage (
  client_id uuid not null references api_clients(id) on delete cascade,
  usage_day date not null,
  request_count integer not null check(request_count>=0),
  primary key(client_id,usage_day)
);

insert into schema_migrations(version) values('0028_lot57pe_client_security');
