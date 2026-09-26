do $$ begin
  if not exists(select 1 from schema_migrations where version='0032_f5_canonical_taxonomy') then
    raise exception 'Migration 0032_f5_canonical_taxonomy must be applied first';
  end if;
end $$;

create table championship_seasons (
  id uuid primary key,
  championship_id text not null references championships(id) on delete restrict,
  key text not null check(btrim(key)<>'' and length(key)<=120),
  label text not null check(btrim(label)<>'' and length(label)<=200),
  start_year integer check(start_year is null or start_year between 1950 and 2200),
  end_year integer check(end_year is null or end_year between 1950 and 2200),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint championship_seasons_years_check check(
    end_year is null or start_year is null or end_year>=start_year
  ),
  constraint championship_seasons_dates_check check(
    ends_on is null or starts_on is null or ends_on>=starts_on
  ),
  constraint championship_seasons_championship_key_unique unique(championship_id,key),
  constraint championship_seasons_id_championship_unique unique(id,championship_id)
);

create index championship_seasons_championship_idx
  on championship_seasons(championship_id,starts_on,start_year,id);

alter table meetings add column championship_season_id uuid;
alter table meetings add constraint meetings_championship_season_scope_fk
  foreign key(championship_season_id,championship_id)
  references championship_seasons(id,championship_id) on delete restrict;
create index meetings_championship_season_idx
  on meetings(championship_season_id) where championship_season_id is not null;

insert into schema_migrations(version) values('0033_f5_championship_seasons');
