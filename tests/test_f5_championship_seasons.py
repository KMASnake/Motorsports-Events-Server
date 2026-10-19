import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UP = ROOT / "infra/postgres/migrations/0033_f5_championship_seasons.up.sql"
DOWN = ROOT / "infra/postgres/migrations/0033_f5_championship_seasons.down.sql"
RUNTIME = ROOT / "scripts/test-f5-championship-seasons.sh"


class F5ChampionshipSeasonTests(unittest.TestCase):
    def setUp(self):
        self.up = UP.read_text(encoding="utf-8")
        self.down = DOWN.read_text(encoding="utf-8")

    def test_migration_is_linear_additive_and_has_no_backfill(self):
        self.assertIn("0032_f5_canonical_taxonomy must be applied first", self.up)
        self.assertIn("create table championship_seasons", self.up)
        self.assertIn("add column championship_season_id uuid", self.up)
        self.assertNotRegex(self.up, r"insert\s+into\s+championship_seasons\s*\([^)]*\)\s*select")
        self.assertNotRegex(self.up, r"update\s+meetings")
        self.assertNotRegex(self.up, r"alter\s+table\s+championships\s+(drop|alter).*season")
        self.assertNotRegex(self.up, r"alter\s+table\s+meetings\s+(drop|alter).*\bseason\b")

    def test_identity_is_scoped_and_year_label_dates_are_not_identity(self):
        self.assertRegex(self.up, r"id uuid primary key")
        self.assertIn("unique(championship_id,key)", self.up)
        self.assertNotIn("unique(start_year)", self.up)
        self.assertNotIn("unique(championship_id,start_year)", self.up)
        self.assertNotIn("unique(label)", self.up)
        self.assertIn("end_year>=start_year", self.up)
        self.assertIn("ends_on>=starts_on", self.up)

    def test_meeting_link_is_nullable_scoped_and_restrictive(self):
        self.assertIn("add column championship_season_id uuid", self.up)
        self.assertIn("foreign key(championship_season_id,championship_id)", self.up)
        self.assertIn("references championship_seasons(id,championship_id) on delete restrict", self.up)
        self.assertNotIn("championship_season_id uuid not null", self.up)

    def test_down_refuses_data_or_links_before_dropping_structures(self):
        linked = self.down.index("meetings where championship_season_id is not null")
        populated = self.down.index("exists(select 1 from championship_seasons)")
        dropped = self.down.index("drop table championship_seasons")
        self.assertLess(linked, dropped)
        self.assertLess(populated, dropped)
        self.assertIn("Refusing 0033 rollback while meetings reference championship seasons", self.down)
        self.assertIn("Refusing 0033 rollback while championship seasons contain data", self.down)

    def test_migration_does_not_change_normalization_or_publication_contracts(self):
        self.assertNotIn("normalized_candidates", self.up)
        self.assertNotIn("normalization_decisions", self.up)
        self.assertNotIn("event_source_links", self.up)
        self.assertNotIn("meeting_source_links", self.up)
        self.assertNotRegex(self.up, r"\b(update|insert into)\s+events\b")
        self.assertNotRegex(self.up, r"\b(update|insert into)\s+meetings\b")

    def test_isolated_runtime_certifies_required_paths(self):
        runtime = RUNTIME.read_text(encoding="utf-8")
        self.assertIn('up -d postgres', runtime)
        self.assertNotIn('up -d worker', runtime)
        self.assertNotIn('up -d api', runtime)
        self.assertIn('down 0033_f5_championship_seasons', runtime)
        self.assertIn('cross-championship season link accepted', runtime)
        self.assertIn('duplicate scoped key accepted', runtime)
        self.assertIn('down accepted while a Meeting is linked', runtime)
        self.assertIn('down accepted while registry contains data', runtime)
        self.assertIn('linked championship season delete accepted', runtime)
        self.assertIn("conname='meetings_championship_season_scope_fk'", runtime)
        self.assertIn("column_name='championship_season_id'", runtime)


if __name__ == "__main__":
    unittest.main()
