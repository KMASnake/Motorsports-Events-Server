import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
UP=(ROOT/'infra/postgres/migrations/0035_f5_provider_discovery_resolution.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0035_f5_provider_discovery_resolution.down.sql').read_text()
SERVICE=(ROOT/'apps/api/src/providers/championshipDiscoveryResolutionService.ts').read_text()
SERVER=(ROOT/'apps/api/src/server.ts').read_text()

class F5DiscoveryResolutionTests(unittest.TestCase):
    def test_linear_migration_and_exact_tables(self):
        self.assertIn("0034_f5_canonical_venues must be applied first",UP)
        self.assertIn("values('0035_f5_provider_discovery_resolution')",UP)
        for table in ('provider_discovery_observations','championship_source_links','championship_season_source_links','championship_discovery_candidates','championship_discovery_decisions'):
            self.assertIn(f'create table {table}',UP)
    def test_db_guarantees_are_fail_closed(self):
        for token in ('provider_discovery_observations_immutable','championship_discovery_decisions_immutable','unique(provider_instance_id,external_championship_id)','unique(provider_instance_id,external_championship_id,external_season_id)','championship_season_source_links_season_scope_fk','octet_length(payload::text)<=65536','decision_fingerprint'):
            self.assertIn(token,UP)
        self.assertIn('Refusing 0035 rollback while F5-4 discovery data exists',DOWN)
        self.assertIn("contype='f'",DOWN)
        self.assertLess(DOWN.index('exists(select 1 from championship_discovery_decisions)'),DOWN.index('drop table championship_discovery_decisions'))
    def test_activation_publication_and_provider_transports_are_absent(self):
        combined=UP+SERVICE
        for token in ('insert into provider_championships','insert into sync_streams','insert into sync_runs','public_resource_states','public_change_log','fetchProviderJson','DiscoverySchedulerRuntime','readSecretForAdapter'):
            self.assertNotIn(token,combined)
        self.assertNotIn('championshipDiscoveryCandidateRoutes', (ROOT/'apps/api/src/worker.ts').read_text())
        self.assertIn('championshipDiscoveryCandidateRoutes',SERVER)
    def test_identity_and_candidate_contract(self):
        self.assertNotIn('championship.key',UP)
        self.assertIn("resolution_state in ('PENDING','REVIEW_REQUIRED','RESOLVED_LINKED','RESOLVED_CREATED','REJECTED')",UP)
        self.assertIn('source_identity_hash',UP);self.assertIn('normalizer_version',UP);self.assertIn('revision bigint',UP)
        self.assertIn("externalSeasonId",SERVICE);self.assertIn("explicit_admin_decision_required",SERVICE)
        self.assertNotIn("aliases",SERVICE.lower())

if __name__=='__main__':unittest.main()
