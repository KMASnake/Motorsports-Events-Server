do $$
declare populated boolean;
begin
  select exists(select 1 from provider_source_corrections)
      or exists(select 1 from provider_source_local_observations)
    into populated;
  if populated and current_setting('mse.allow_destructive_lot56_down',true) is distinct from 'on' then
    raise exception using message='Destructive Lot 5.6-F rollback refused: protected source data exists.',hint='Set mse.allow_destructive_lot56_down=on only on a disposable database where data loss is explicitly accepted.';
  end if;
  if populated then raise warning 'DESTRUCTIVE OPERATION: dropping protected Lot 5.6-F source data'; end if;
end $$;

drop table provider_source_local_observations;
drop table provider_source_corrections;
delete from schema_migrations where version='0023_lot56_source_protection';
