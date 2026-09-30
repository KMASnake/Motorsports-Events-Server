from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
HARNESS=(ROOT/'scripts/test-f57c-deterministic-e2e.sh').read_text()
TEST=(ROOT/'apps/api/tests/f57cEndToEnd.postgres.test.ts').read_text()
UP=(ROOT/'infra/postgres/migrations/0039_f5_confirmed_event_status.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0039_f5_confirmed_event_status.down.sql').read_text()

class F57CStaticSafety(unittest.TestCase):
    def test_isolated_database_and_exact_schema_head(self):
        self.assertIn("test -z \"${DATABASE_URL:-}\"",HARNESS)
        self.assertIn('--publish 127.0.0.1::5432',HARNESS)
        self.assertIn('0039_f5_confirmed_event_status',HARNESS)
        self.assertNotIn('0040_',HARNESS+TEST+UP+DOWN)
    def test_confirmed_migration_is_minimal_and_down_is_fail_closed(self):
        self.assertIn("status in ('draft','scheduled','confirmed','completed','cancelled','postponed')",UP)
        self.assertIn("exists(select 1 from events where status='confirmed')",DOWN)
        self.assertLess(DOWN.index('rollback refused'),DOWN.index('alter table events'))
        self.assertIn('populated confirmed-status DOWN unexpectedly succeeded',HARNESS)
    def test_no_provider_or_worker_execution(self):
        for forbidden in ('providerAcquireOnce','providerOneShotRunner','docker compose','worker','scheduler'):
            self.assertNotIn(forbidden,HARNESS)
        self.assertIn('f57c_unexpected_network_attempt',TEST)
    def test_real_postgres_services_and_http_contract(self):
        for required in ('test-f5-multi-provider-reconciliation.sh','CanonicalCatalogPublicationService','PostgresPreviewRepository','previewSecurityRoutes','/api/v1/changes'):
            self.assertIn(required,HARNESS+TEST)
    def test_fail_closed_and_evidence_not_status_only(self):
        for required in ('canonical_publication_establishment_disabled','public_resource_versions','public_change_log','revision','tombstones','statusCode).toBe(401','statusCode).toBe(404'):
            self.assertIn(required,TEST)

if __name__=='__main__': unittest.main()
