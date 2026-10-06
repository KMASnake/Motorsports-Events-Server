drop index provider_acquisition_state_history_idx;
alter table provider_acquisition_state
  drop column finalization_last_checked_at,
  drop column deep_history_completed_at,
  drop column current_cycle_started_at,
  drop column current_stage;

delete from schema_migrations where version='0019_lot56_durable_orchestration';
