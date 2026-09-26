import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
UP=(ROOT/'infra/postgres/migrations/0034_f5_canonical_venues.up.sql').read_text()
DOWN=(ROOT/'infra/postgres/migrations/0034_f5_canonical_venues.down.sql').read_text()
RUNTIME=(ROOT/'scripts/test-f5-venues.sh').read_text()

class F5VenueTests(unittest.TestCase):
    def test_linear_additive_schema_and_no_backfill(self):
        self.assertIn('0033_f5_championship_seasons must be applied first',UP)
        for table in ('venue_kinds','venues','venue_layouts','circuit_venue_links'):
            self.assertIn(f'create table {table}',UP)
        self.assertNotRegex(UP,r'alter\s+table\s+(circuits|meetings|events)')
        self.assertNotRegex(UP,r'insert\s+into\s+(venues|venue_layouts|circuit_venue_links)')
        self.assertNotIn('venue_source_links',UP);self.assertNotIn('venue_layout_source_links',UP)
    def test_identity_and_mapping_constraints(self):
        self.assertRegex(UP,r'create table venues \([\s\S]*?id uuid primary key')
        self.assertIn('key text not null unique',UP)
        self.assertIn('unique(venue_id,key)',UP)
        self.assertIn('unique(id,venue_id)',UP)
        self.assertIn('foreign key(venue_layout_id,venue_id)',UP)
        self.assertIn('references venue_layouts(id,venue_id) on delete restrict',UP)
        self.assertIn('f5_immutable_machine_key',UP)
    def test_coordinates_and_extensible_kinds(self):
        self.assertIn('(latitude is null)=(longitude is null)',UP)
        self.assertIn('latitude between -90 and 90',UP)
        self.assertIn('longitude between -180 and 180',UP)
        self.assertNotIn('create type venue',UP.lower())
        for key in ('circuit','street_circuit','rally_location','service_park','stage_location','test_track','other'):
            self.assertIn(f"('{key}'",UP)
    def test_down_is_fail_closed_before_ddl_and_future_dependencies(self):
        drop=DOWN.index('drop table circuit_venue_links')
        for token in ('exists(select 1 from circuit_venue_links)','exists(select 1 from venue_layouts)','exists(select 1 from venues)','venue kinds contain extension data','pg_constraint'):
            self.assertLess(DOWN.index(token),drop)
        self.assertIn("contype='f'",DOWN)
    def test_runtime_covers_constraints_without_worker_provider_or_api(self):
        for token in ('duplicate Venue key accepted','duplicate Layout key accepted','cross-Venue Layout mapping accepted','referenced Venue delete accepted','referenced Layout delete accepted','linked Circuit delete accepted','down accepted while Venue populated','down accepted with future dependency','circuit_venue_links_layout_scope_fk'):
            self.assertIn(token,RUNTIME)
        self.assertNotIn('up -d worker',RUNTIME);self.assertNotIn('up -d api',RUNTIME)
        self.assertIn('BACKFILL_EXECUTED=NO PROVIDER_CALLS=0 WORKER_STARTED=NO',RUNTIME)
    def test_provider_publication_and_canonical_tables_are_untouched(self):
        forbidden=('apps/api/src/providers','apps/api/src/normalization','PUBLIC_FIELDS','public_resource_states','event_source_links','meeting_source_links','meetings.venue_id','events.venue_id')
        combined=UP+DOWN
        for value in forbidden:self.assertNotIn(value,combined)

if __name__=='__main__':unittest.main()
