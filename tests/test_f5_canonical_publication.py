import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
UP=(ROOT/'infra/postgres/migrations/0038_f5_canonical_publication.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0038_f5_canonical_publication.down.sql').read_text()
SERVICE=(ROOT/'apps/api/src/public/canonicalCatalogPublicationService.ts').read_text()
REPOSITORY=(ROOT/'apps/api/src/preview/repository.ts').read_text()
HARNESS=(ROOT/'scripts/test-f5-canonical-publication.sh').read_text()
SEASONS=(ROOT/'apps/api/src/championshipSeasons/championshipSeasonService.ts').read_text()
VENUES=(ROOT/'apps/api/src/venues/venueService.ts').read_text()
CHAMPIONSHIPS=(ROOT/'apps/api/src/routes/championships.ts').read_text()
DISCOVERY=(ROOT/'apps/api/src/providers/discoveryService.ts').read_text()
RESOLUTION=(ROOT/'apps/api/src/providers/championshipDiscoveryResolutionService.ts').read_text()
MANUAL=(ROOT/'apps/api/src/providers/manualSourceService.ts').read_text()
SCHEDULER=(ROOT/'apps/api/src/providers/schedulerService.ts').read_text()
ESTABLISH=(ROOT/'scripts/establish-f5-canonical-publication.mjs').read_text()

class F5CanonicalPublicationTests(unittest.TestCase):
    def test_0038_extends_the_existing_versioned_pipeline_only(self):
        for table in ['public_resource_states','public_change_log','public_resource_versions']:
            self.assertIn(f'alter table {table}',UP)
        for kind in ['championshipSeason','venue','venueLayout']:
            self.assertIn(kind,UP)
        self.assertNotIn('create table',UP.lower())
        self.assertIn("values('0038_f5_canonical_publication')",UP)

    def test_down_refuses_when_any_new_publication_evidence_exists(self):
        for table in ['public_resource_states','public_change_log','public_resource_versions']:
            self.assertIn(f'exists(select 1 from {table}',DOWN)
        self.assertLess(DOWN.index('rollback refused'),DOWN.index('alter table'))
        self.assertIn("delete from schema_migrations where version='0038_f5_canonical_publication'",DOWN)

    def test_catalog_publication_uses_one_existing_state_version_change_pipeline(self):
        for table in ['public_resource_states','public_change_log','public_resource_versions']:
            self.assertIn(f'insert into {table}',SERVICE)
        self.assertIn('publication_tombstone_permanent',SERVICE)
        self.assertIn("outcome:'unchanged'",SERVICE)
        self.assertNotIn('provider_source_',SERVICE)
        self.assertNotIn('normalized_candidates',SERVICE)
        self.assertIn('removeInTransaction',SERVICE)

    def test_canonical_admin_mutations_are_wired_to_catalog_publication(self):
        self.assertIn("resourceType:'championshipSeason'",SEASONS)
        self.assertIn("resourceType:'venue'",VENUES)
        self.assertIn("resourceType:'venueLayout'",VENUES)
        self.assertIn("resourceType:'championship'",CHAMPIONSHIPS)
        self.assertIn('removeInTransaction',CHAMPIONSHIPS)
        for source in [DISCOVERY,RESOLUTION,MANUAL]:
            self.assertIn('publishInTransaction',source)
        self.assertIn("resourceType:'championship'",SCHEDULER)

    def test_existing_catalog_establishment_is_explicit_idempotent_and_schema_guarded(self):
        self.assertIn("F57B_ESTABLISH!=='authorized'",ESTABLISH)
        self.assertIn("head!=='0038_f5_canonical_publication'",ESTABLISH)
        self.assertIn('.establish(new Date())',ESTABLISH)
        self.assertIn('canonical_publication_establishment_disabled',SERVICE)
        self.assertIn('canonical_publication_establishment_incomplete',SERVICE)
        self.assertNotIn('provider',ESTABLISH.lower())

    def test_changes_reuses_entitlements_and_allows_only_global_catalogs(self):
        self.assertIn("v.resource_type in ('venue','venueLayout')",REPOSITORY)
        self.assertIn('v.championship_id=any($3::text[])',REPOSITORY)

    def test_postgres_harness_proves_forward_empty_down_refusal_and_reupgrade(self):
        self.assertIn('test "$version" = 0038_f5_canonical_publication&&break',HARNESS)
        self.assertGreaterEqual(HARNESS.count('0038_f5_canonical_publication.up.sql'),2)
        self.assertIn('0038_f5_canonical_publication.down.sql',HARNESS)
        self.assertIn('populated DOWN unexpectedly succeeded',HARNESS)
        self.assertIn('--publish 127.0.0.1::5432',HARNESS)
        self.assertIn('canonicalCatalogPublication.postgres.test.ts',HARNESS)
        self.assertIn('RUN_F57B_POSTGRES=1',HARNESS)

if __name__=='__main__': unittest.main()
