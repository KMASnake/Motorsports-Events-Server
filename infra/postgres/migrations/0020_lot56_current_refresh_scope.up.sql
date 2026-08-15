alter table provider_source_entities
  add column acquisition_scope text not null default 'unclassified'
    check(acquisition_scope in ('past','current_hot','current_future','finalization','unclassified'));

create index provider_source_entities_refresh_scope_idx
  on provider_source_entities(provider_championship_id,acquisition_scope,theoretical_end_at);

insert into schema_migrations(version)
values('0020_lot56_current_refresh_scope') on conflict do nothing;
