alter table provider_acquisition_state drop column finalization_cursor_season;

alter table provider_acquisition_traversals
  drop constraint provider_acquisition_traversals_work_class_check;

update provider_acquisition_traversals
set work_class='current_hot'
where work_class='current_global';

alter table provider_acquisition_traversals
  add constraint provider_acquisition_traversals_work_class_check
    check(work_class in ('current_hot','current_future','finalization','recent_catchup','deep_history'));

delete from schema_migrations where version='0021_lot56_current_global_finalization_queue';
