do $$ begin
  if exists(select 1 from meeting_source_contributions)
    or exists(select 1 from event_source_contributions)
    or exists(select 1 from reconciliation_policies)
    or exists(select 1 from reconciliation_runs)
    or exists(select 1 from reconciliation_conflicts)
    or exists(select 1 from canonical_field_overrides)
    or exists(select 1 from canonical_field_override_history)
    or exists(select 1 from canonical_override_mutations)
    or exists(select 1 from contribution_status_events)
  then raise exception 'Refusing destructive 0037 downgrade while F5-6 evidence exists'; end if;
end $$;
drop trigger event_corrections_read_only on event_corrections;
drop function f5_reject_legacy_event_correction_write();
drop trigger canonical_field_overrides_identity on canonical_field_overrides;
drop function f5_validate_override_identity();
drop trigger meeting_source_contributions_status on meeting_source_contributions;
drop trigger event_source_contributions_status on event_source_contributions;
drop trigger meeting_source_contributions_immutable on meeting_source_contributions;
drop trigger event_source_contributions_immutable on event_source_contributions;
drop function f5_record_contribution_status();
drop function f5_guard_contribution_snapshot();
drop function f5_reject_evidence_mutation() cascade;
drop table reconciliation_conflicts,reconciliation_field_decisions,reconciliation_runs,
  canonical_override_mutations,canonical_field_override_history,canonical_field_overrides,event_source_contributions,
  meeting_source_contributions,contribution_status_events,reconciliation_policy_field_rules,reconciliation_policies;
drop function f5_reject_active_policy_mutation();
drop function f5_reject_active_policy_rule_mutation();
alter table normalized_candidates drop constraint normalized_candidates_source_correction_identity_key;
alter table normalized_candidates drop column source_correction_set_checksum;
alter table normalized_candidates add unique(source_entity_id,source_hash,normalization_version,resource_kind);
alter table provider_source_entities drop column source_revision;
delete from schema_migrations where version='0037_f5_multi_provider_reconciliation';
