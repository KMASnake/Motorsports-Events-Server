do $$
declare
  populated boolean;
begin
  select exists(select 1 from provider_source_entities)
      or exists(select 1 from provider_source_changes)
      or exists(select 1 from provider_source_observations)
      or exists(select 1 from provider_acquisition_anomalies)
      or exists(select 1 from provider_acquisition_traversals)
    into populated;

  if populated and current_setting('mse.allow_destructive_lot56_down', true) is distinct from 'on' then
    raise exception using
      message = 'Destructive Lot 5.6 rollback refused: durable acquisition data exists.',
      hint = 'The down migration is only for disposable development/test databases. Set mse.allow_destructive_lot56_down=on explicitly only when data loss is accepted.';
  end if;
  if populated then
    raise warning 'DESTRUCTIVE OPERATION: dropping all persisted Lot 5.6 acquisition data';
  end if;
end $$;

drop table provider_acquisition_anomalies;
drop table provider_source_changes;
drop table provider_source_observations;
drop function enforce_provider_source_observation_scope();
drop table provider_source_entities;
drop table provider_acquisition_traversals;
drop table provider_acquisition_state;

alter table provider_championships
  drop constraint provider_championships_id_provider_unique,
  drop constraint provider_championships_history_mode_start_check,
  drop column acquisition_finalization_grace_days,
  drop column acquisition_current_hot_days,
  drop column acquisition_empty_season_limit,
  drop column acquisition_history_from_season,
  drop column acquisition_history_mode;

delete from schema_migrations where version='0016_lot56_durable_acquisition';
