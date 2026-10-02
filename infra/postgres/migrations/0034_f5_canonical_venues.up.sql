do $$ begin
  if not exists(select 1 from schema_migrations where version='0033_f5_championship_seasons') then
    raise exception 'Migration 0033_f5_championship_seasons must be applied first';
  end if;
end $$;

create table venue_kinds (
  key text primary key check(key=btrim(key) and key~'^[a-z0-9]+([._-][a-z0-9]+)*$' and length(key)<=64),
  label text not null check(label=btrim(label) and label<>'' and length(label)<=120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into venue_kinds(key,label) values
  ('circuit','Circuit'),
  ('street_circuit','Circuit urbain'),
  ('rally_location','Lieu de rallye'),
  ('service_park','Parc d''assistance'),
  ('stage_location','Lieu de spéciale'),
  ('test_track','Piste d''essais'),
  ('other','Autre');

create table venues (
  id uuid primary key,
  key text not null unique check(key=btrim(key) and key~'^[a-z0-9]+([._:-][a-z0-9]+)*$' and length(key)<=120),
  name text not null check(name=btrim(name) and name<>'' and length(name)<=200),
  kind_key text not null references venue_kinds(key) on delete restrict,
  city text check(city is null or (city=btrim(city) and city<>'' and length(city)<=160)),
  region text check(region is null or (region=btrim(region) and region<>'' and length(region)<=160)),
  country_code char(2) check(country_code is null or country_code~'^[A-Z]{2}$'),
  timezone text check(timezone is null or (timezone=btrim(timezone) and timezone<>'' and length(timezone)<=128)),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_coordinate_pair_check check((latitude is null)=(longitude is null)),
  constraint venues_latitude_check check(latitude is null or latitude between -90 and 90),
  constraint venues_longitude_check check(longitude is null or longitude between -180 and 180)
);
create index venues_kind_idx on venues(kind_key,id);

create table venue_layouts (
  id uuid primary key,
  venue_id uuid not null references venues(id) on delete restrict,
  key text not null check(key=btrim(key) and key~'^[a-z0-9]+([._:-][a-z0-9]+)*$' and length(key)<=120),
  name text not null check(name=btrim(name) and name<>'' and length(name)<=200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_layouts_venue_key_unique unique(venue_id,key),
  constraint venue_layouts_id_venue_unique unique(id,venue_id)
);
create index venue_layouts_venue_idx on venue_layouts(venue_id,id);

create table circuit_venue_links (
  circuit_id text primary key references circuits(id) on delete restrict,
  venue_id uuid not null references venues(id) on delete restrict,
  venue_layout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circuit_venue_links_layout_scope_fk
    foreign key(venue_layout_id,venue_id)
    references venue_layouts(id,venue_id) on delete restrict
);
create index circuit_venue_links_venue_idx on circuit_venue_links(venue_id,circuit_id);
create index circuit_venue_links_layout_idx on circuit_venue_links(venue_layout_id) where venue_layout_id is not null;

create function f5_immutable_machine_key() returns trigger language plpgsql as $$
begin
  if new.key is distinct from old.key then
    raise exception '% key is immutable', tg_table_name using errcode='23514';
  end if;
  return new;
end $$;
create trigger venues_key_immutable before update on venues
  for each row execute function f5_immutable_machine_key();
create trigger venue_layouts_key_immutable before update on venue_layouts
  for each row execute function f5_immutable_machine_key();

insert into schema_migrations(version) values('0034_f5_canonical_venues');
