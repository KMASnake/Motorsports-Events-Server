do $$ begin
  if (exists(select 1 from public_resource_states) or exists(select 1 from public_change_log))
     and current_setting('mse.allow_destructive_lot57pc_down',true) is distinct from 'on' then
    raise exception using message='Destructive Lot 5.7-P-C rollback refused: publication data exists.',hint='Set mse.allow_destructive_lot57pc_down=on only on an explicitly disposable database.';
  end if;
end $$;
drop table publication_rebuild_checkpoints;
drop table publication_receipts;
drop table public_change_log;
drop sequence public_change_sequence;
drop trigger public_resource_states_permanent_tombstone on public_resource_states;
drop function reject_public_tombstone_mutation();
drop table public_resource_states;
drop table publication_controls;
delete from schema_migrations where version='0025_lot57pc_publication_state';
