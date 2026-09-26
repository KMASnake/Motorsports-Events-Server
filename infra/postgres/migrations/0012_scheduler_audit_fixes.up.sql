do $$ begin
  if not exists(select 1 from schema_migrations where version='0011_persistent_sync_scheduler') then
    raise exception 'Migration 0011_persistent_sync_scheduler must be applied first';
  end if;
end $$;

alter table provider_championships
  add column sync_state_before_championship_disable text
    check(sync_state_before_championship_disable in ('inactive','active','paused','suspended','error'));

insert into schema_migrations(version) values('0012_scheduler_audit_fixes') on conflict do nothing;
