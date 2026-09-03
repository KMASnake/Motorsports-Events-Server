alter table provider_acquisition_traversals
  drop constraint provider_acquisition_traversals_work_class_check;

update provider_acquisition_traversals
set work_class='current_global'
where work_class in ('current_hot','current_future');

alter table provider_acquisition_traversals
  add constraint provider_acquisition_traversals_work_class_check
    check(work_class in ('current_global','current_hot','current_future','finalization','recent_catchup','deep_history'));

alter table provider_acquisition_state
  add column finalization_cursor_season integer;

insert into schema_migrations(version)
values('0021_lot56_current_global_finalization_queue') on conflict do nothing;
