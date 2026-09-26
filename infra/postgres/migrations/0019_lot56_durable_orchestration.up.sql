alter table provider_acquisition_state
  add column current_stage text not null default 'hot'
    check(current_stage in ('hot','future')),
  add column current_cycle_started_at timestamptz,
  add column deep_history_completed_at timestamptz,
  add column finalization_last_checked_at timestamptz;

create index provider_acquisition_state_history_idx
  on provider_acquisition_state(deep_history_state,deep_history_season);

insert into schema_migrations(version)
values('0019_lot56_durable_orchestration') on conflict do nothing;
