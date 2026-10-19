do $$ begin
  if exists(select 1 from meetings where championship_season_id is not null) then
    raise exception 'Refusing 0033 rollback while meetings reference championship seasons';
  end if;
  if exists(select 1 from championship_seasons) then
    raise exception 'Refusing 0033 rollback while championship seasons contain data';
  end if;
end $$;

drop index meetings_championship_season_idx;
alter table meetings drop constraint meetings_championship_season_scope_fk;
alter table meetings drop column championship_season_id;
drop index championship_seasons_championship_idx;
drop table championship_seasons;

delete from schema_migrations where version='0033_f5_championship_seasons';
