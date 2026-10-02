do $$ begin
  if not exists(select 1 from schema_migrations where version='0040_f5_canonical_timezone_nullability') then
    raise exception 'Migration 0040_f5_canonical_timezone_nullability must be applied first';
  end if;
end $$;

-- Keep semantic idempotence within a revision, without colliding with an
-- immutable decision from an earlier evaluation of the same candidate.
-- A review and a subsequent manual terminal decision may share a revision.
-- The candidate/key uniqueness and state-transition trigger remain in force.
alter table normalization_decisions
  drop constraint normalization_decisions_idempotency_unique,
  add constraint normalization_decisions_idempotency_unique unique nulls not distinct
    (source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version);

insert into schema_migrations(version) values('0041_f5_revisioned_normalization_decisions');
