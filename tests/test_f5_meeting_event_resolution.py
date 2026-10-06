import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
UP=(ROOT/'infra/postgres/migrations/0036_f5_meeting_event_canonical_resolution.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0036_f5_meeting_event_canonical_resolution.down.sql').read_text()
NORMALIZER=(ROOT/'apps/api/src/normalization/postgresDeterministicNormalizationService.ts').read_text()
PUBLICATION=(ROOT/'apps/api/src/normalization/postgresPublicationService.ts').read_text()
RESOLUTION=(ROOT/'apps/api/src/normalization/meetingEventResolutionService.ts').read_text()
RUNTIME=(ROOT/'scripts/test-f5-meeting-event-resolution.sh').read_text()

class F5MeetingEventResolutionTests(unittest.TestCase):
    def test_linear_migration_and_no_event_season_column(self):
        self.assertIn('0035_f5_provider_discovery_resolution must be applied first',UP)
        self.assertIn("values('0036_f5_meeting_event_canonical_resolution')",UP)
        self.assertNotIn('events.championship_season_id',UP)
        self.assertNotRegex(UP,r'alter table events[\s\S]{0,300}add column championship_season_id')
    def test_parent_and_championship_invariants_are_deferred_and_fail_closed(self):
        for token in ('events_canonical_parent_required','meeting_events_canonical_parent_integrity','meetings_canonical_child_integrity','after update of championship_id on meetings','deferrable initially deferred','must belong to exactly one Meeting','championships differ'):
            self.assertIn(token,UP)
        self.assertIn('canonical orphan accepted',RUNTIME)
        self.assertIn('canonical parent removal accepted',RUNTIME)
        self.assertIn('cross-Championship Event accepted',RUNTIME)
        self.assertIn('cross-Championship Meeting mutation accepted',RUNTIME)
        self.assertIn('cross-Championship parent reassignment accepted',RUNTIME)
    def test_venue_layout_and_session_type_are_data_backed(self):
        for token in ('meetings_venue_layout_scope_fk','events_venue_layout_scope_fk','references venue_layouts(id,venue_id)','session_type_key text references session_types(key)',"else 'other'"):
            self.assertIn(token,UP)
        self.assertIn('f5-rally-location',RUNTIME)
        self.assertNotIn("sessionType in ('",NORMALIZER)
    def test_exact_links_canonical_season_and_parent_precede_heuristics(self):
        self.assertLess(NORMALIZER.index('meeting_source_links where source_entity_id'),NORMALIZER.index('candidateRows='))
        self.assertLess(NORMALIZER.index('event_source_links where source_entity_id'),NORMALIZER.index('candidateRows='))
        self.assertIn('championship_season_source_links',NORMALIZER)
        self.assertIn('meeting.championship_season_id=$2',NORMALIZER)
        self.assertNotIn('extract(year from event.starts_at)::int=$2',NORMALIZER)
    def test_decision_contract_and_concurrency_are_fail_closed(self):
        for token in ('candidate_revision','idempotency_key','decision_fingerprint','RESOLVED_LINKED','RESOLVED_CREATED','Normalization candidate is terminal','for update'):
            self.assertIn(token,UP+RESOLUTION)
        self.assertNotIn('foreign key(candidate_id,candidate_revision)',UP)
        self.assertIn("revision=revision+1,resolution_state='PENDING'",NORMALIZER)
        self.assertIn('pg_advisory_xact_lock',NORMALIZER)
        self.assertIn('pg_advisory_xact_lock',RESOLUTION)
        self.assertIn('Idempotency key conflicts',RESOLUTION)
    def test_linked_sources_never_reconcile_canonical_metadata(self):
        linked=PUBLICATION.index("if(String(row.decision)==='linked')")
        created=PUBLICATION.index("if(String(row.decision)==='create')")
        self.assertLess(linked,created)
        self.assertNotIn('insert into meetings(',PUBLICATION[linked:created])
        self.assertNotIn('insert into events(',PUBLICATION[linked:created])
        self.assertIn("outcome:'linked'",PUBLICATION[linked:created])
        self.assertIn('on conflict(id) do update',PUBLICATION[created:])
        self.assertIn("if(current?.state_checksum===checksum)",PUBLICATION)
        self.assertIn("outcome:'unchanged'",PUBLICATION)
        self.assertEqual(PUBLICATION.count('insert into public_change_log('),2) # promote and explicit remove only
    def test_unresolved_parent_cannot_materialize_any_event_artifact(self):
        parent_guard=PUBLICATION.index("if(!parent?.meeting_id)return {outcome:'review_required'")
        self.assertLess(parent_guard,PUBLICATION.index('insert into events('))
        self.assertLess(parent_guard,PUBLICATION.index('insert into event_source_links('))
        self.assertLess(parent_guard,PUBLICATION.index('insert into meeting_events('))
    def test_down_refuses_before_ddl_and_preserves_previous_migrations(self):
        self.assertLess(DOWN.index('Refusing 0036 rollback'),DOWN.index('drop trigger'))
        self.assertNotIn(' cascade',DOWN.lower())
        self.assertIn('depends on F5-5 schema',DOWN)
        self.assertIn('constraint_row.conkey &&',DOWN)
        self.assertIn('F5-5 populated DOWN accepted',RUNTIME)
        for version in range(31,36):
            self.assertNotIn(f'delete from schema_migrations where version=\'00{version}',DOWN)
    def test_scope_excludes_provider_execution_and_future_phases(self):
        combined=UP+DOWN+RESOLUTION+RUNTIME
        for token in ('fetchProviderJson','readSecretForAdapter','start:worker','up -d worker','insert into sync_runs','insert into provider_request_charges'):
            self.assertNotIn(token,combined)

if __name__=='__main__':unittest.main()
