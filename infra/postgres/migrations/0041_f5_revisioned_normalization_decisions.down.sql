-- Never erase decision history to restore the obsolete uniqueness rule.
do $$ begin
  if exists(
    select 1 from normalization_decisions
    group by source_entity_id,candidate_id,decision,target_kind,target_id,normalization_version
    having count(*)>1
  ) then
    raise exception 'Cannot restore legacy decision uniqueness: revisioned history must be preserved';
  end if;
end $$;

alter table normalization_decisions
  drop constraint normalization_decisions_idempotency_unique,
  add constraint normalization_decisions_idempotency_unique unique nulls not distinct
    (source_entity_id,candidate_id,decision,target_kind,target_id,normalization_version);

delete from schema_migrations where version='0041_f5_revisioned_normalization_decisions';
