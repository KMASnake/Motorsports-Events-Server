import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
UP=(ROOT/'infra/postgres/migrations/0037_f5_multi_provider_reconciliation.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0037_f5_multi_provider_reconciliation.down.sql').read_text()
EVENT=(ROOT/'apps/api/src/lib/eventCorrections.ts').read_text()
SOURCE=(ROOT/'apps/api/src/normalization/postgresDeterministicNormalizationService.ts').read_text()
HARNESS=(ROOT/'scripts/test-f5-multi-provider-reconciliation.sh').read_text()
F55_HARNESS=(ROOT/'scripts/test-f5-meeting-event-resolution.sh').read_text()
RECONCILIATION=(ROOT/'apps/api/src/reconciliation/postgresReconciliationService.ts').read_text()
MAPPING=(ROOT/'apps/api/src/reconciliation/legacyEventFieldMapping.ts').read_text()
FIELD_CONTRACT=(ROOT/'apps/api/src/reconciliation/reconciliationFieldContract.ts').read_text()
OVERRIDE_SERVICE=(ROOT/'apps/api/src/reconciliation/canonicalFieldOverrideService.ts').read_text()

class F5MultiProviderReconciliationTests(unittest.TestCase):
    def test_schema_and_immutable_evidence(self):
        for table in ['meeting_source_contributions','event_source_contributions','reconciliation_policies','reconciliation_policy_field_rules','reconciliation_runs','reconciliation_field_decisions','reconciliation_conflicts','canonical_field_overrides','canonical_field_override_history']:
            self.assertIn(f'create table {table}',UP)
        self.assertIn("values('0037_f5_multi_provider_reconciliation')",UP)
        self.assertIn('unique(source_entity_id,contribution_checksum)',UP)
        self.assertNotIn('on update cascade',UP.lower())

    def test_legacy_import_is_fail_closed_and_single_authority(self):
        self.assertIn("status in ('active','conflict')",UP)
        self.assertIn('legacy_event_correction_id text unique',UP)
        self.assertIn('Legacy Event correction import is divergent',UP)
        self.assertIn('event_corrections_read_only',UP)
        self.assertNotIn('insert into event_corrections',EVENT.lower())
        self.assertNotIn('update event_corrections',EVENT.lower())
        self.assertNotIn('delete from event_corrections',EVENT.lower())

    def test_source_corrections_remain_upstream(self):
        self.assertIn('provider_source_corrections',SOURCE)
        self.assertNotIn('provider_source_corrections',EVENT)
        self.assertNotIn('drop table provider_source_corrections',DOWN)
        self.assertNotIn('drop table event_corrections',DOWN)

    def test_p1_source_revision_and_legacy_mapping_are_explicit(self):
        self.assertIn('source_revision bigint not null default 1 check(source_revision>0)',UP)
        self.assertIn('ambiguous_source_contribution_succession',RECONCILIATION)
        self.assertNotIn('order by contribution.observed_at desc',RECONCILIATION.lower())
        self.assertNotIn('order by contribution.received_at desc',RECONCILIATION.lower())
        for legacy,logical in [('name','name'),('starts_at','startsAt'),('ends_at','endsAt'),('status','status'),('session_title','sessionLabel')]:
            self.assertIn(f"{legacy}:'{logical}'",MAPPING)
        self.assertIn("'legacy-matrix-starts'",HARNESS)
        self.assertIn("'legacy-matrix-ends'",HARNESS)
        self.assertIn("'legacy-matrix-session'",HARNESS)

    def test_down_is_destructive_only_when_empty(self):
        self.assertIn('Refusing destructive 0037 downgrade',DOWN)
        self.assertLess(DOWN.index('Refusing destructive 0037 downgrade'),DOWN.index('drop table'))
        for table in ['meeting_source_contributions','event_source_contributions','reconciliation_policies','reconciliation_runs','reconciliation_conflicts','canonical_field_overrides','canonical_field_override_history']:
            self.assertIn(f'exists(select 1 from {table})',DOWN)

    def test_postgres_harness_requires_stable_readiness(self):
        self.assertIn('ready_checks=0',HARNESS)
        self.assertIn('ready_checks=$((ready_checks+1))',HARNESS)
        self.assertIn('[[ "${ready_checks}" -ge 3 ]]',HARNESS)
        self.assertIn('F5-6 PostgreSQL did not reach stable readiness.',HARNESS)

    def test_f5_5_regression_runs_on_current_0037_schema(self):
        self.assertIn('== 0037_f5_multi_provider_reconciliation',F55_HARNESS)
        self.assertIn('down 0037_f5_multi_provider_reconciliation',F55_HARNESS)

    def test_p2_immutable_evidence_and_lifecycle_journal_are_database_enforced(self):
        self.assertIn('create table contribution_status_events',UP)
        for trigger in ['meeting_source_contributions_immutable','event_source_contributions_immutable','reconciliation_runs_append_only','reconciliation_field_decisions_append_only','canonical_field_override_history_append_only','canonical_override_mutations_append_only','contribution_status_events_append_only']:
            self.assertIn(f'create trigger {trigger}',UP)
        self.assertIn("if new.withdrawn_at is distinct from old.withdrawn_at",UP)
        self.assertIn("raise exception '% contribution snapshot is immutable'",UP)
        self.assertIn("raise exception '% is append-only evidence'",UP)

    def test_p2_provider_observations_use_the_authoritative_override_audit(self):
        self.assertIn("'provider_observed'",UP)
        self.assertIn("'provider_observation'",UP)
        self.assertIn('canonical_field_override_history',OVERRIDE_SERVICE)
        self.assertIn('canonical_override_mutations',OVERRIDE_SERVICE)
        self.assertIn('recordProviderObservationInTransaction',OVERRIDE_SERVICE)

    def test_p2_shared_field_contract_and_derived_identity_are_explicit(self):
        for field in ['name','round','startsAt','endsAt','venueId','venueLayoutId','sessionLabel','sessionType','status']:
            self.assertIn(field,FIELD_CONTRACT)
        self.assertIn('field_class_mismatch',FIELD_CONTRACT)
        self.assertIn('venue_layout_scope_invalid',FIELD_CONTRACT)
        self.assertIn('canonical_identity_mismatch',OVERRIDE_SERVICE)
        self.assertIn('canonical_entity_not_found',OVERRIDE_SERVICE)

    def test_p2_indexes_match_actual_target_and_source_revision_access(self):
        for index in ['meeting_source_contributions_target_revision_idx','event_source_contributions_target_revision_idx','meeting_source_contributions_source_revision_idx','event_source_contributions_source_revision_idx','reconciliation_runs_entity_created_idx','reconciliation_conflicts_open_idx']:
            self.assertIn(f'create index {index}',UP)

if __name__=='__main__': unittest.main()
