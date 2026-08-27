create table if not exists championships (
  id text primary key,
  slug text not null unique,
  name text not null,
  short_name text,
  official_name text,
  category text,
  season integer not null default 2026,
  active boolean not null default true,
  sync_enabled boolean not null default false,
  provider_key text,
  external_id text,
  logo_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circuits (
  id text primary key,
  name text not null,
  city text,
  country_code char(2),
  timezone text not null default 'Europe/Paris'
);

create table if not exists events (
  id text primary key,
  championship_id text not null references championships(id) on delete restrict,
  circuit_id text references circuits(id) on delete set null,
  name text not null,
  slug text not null unique,
  category text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Europe/Paris',
  status text not null default 'scheduled' check(status in ('draft','scheduled','completed','cancelled','postponed')),
  published boolean not null default true,
  origin text not null default 'manual' check(origin in ('manual','provider','mixed')),
  provider_key text,
  external_id text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at >= starts_at)
);

create index if not exists events_starts_at_idx on events(starts_at);
create index if not exists events_championship_idx on events(championship_id);
create index if not exists events_status_idx on events(status);

insert into championships(
  id, slug, name, short_name, official_name, category, season,
  active, sync_enabled, provider_key, external_id, description
) values
  ('f1','formula-1','Formule 1','F1','FIA Formula One World Championship','Monoplace',2026,true,true,'primary','formula-1','Championnat du monde de Formule 1.'),
  ('motogp','motogp','MotoGP','MotoGP','FIM MotoGP World Championship','Vitesse moto',2026,true,true,'primary','moto-gp','Catégorie reine des Grands Prix moto.'),
  ('wrc','wrc','WRC','WRC','FIA World Rally Championship','Rallye',2026,true,false,null,null,'Championnat du monde des rallyes.')
on conflict (id) do update set
  slug=excluded.slug,
  short_name=excluded.short_name,
  official_name=excluded.official_name,
  category=excluded.category,
  season=excluded.season,
  updated_at=now();

insert into circuits(id,name,city,country_code,timezone) values
  ('lemans','Circuit Bugatti','Le Mans','FR','Europe/Paris'),
  ('silverstone','Silverstone Circuit','Silverstone','GB','Europe/London'),
  ('monza','Autodromo Nazionale Monza','Monza','IT','Europe/Rome'),
  ('sachsenring','Sachsenring','Hohenstein-Ernstthal','DE','Europe/Berlin')
on conflict (id) do update set city=excluded.city, timezone=excluded.timezone;
