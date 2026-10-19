import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
UP = ROOT / "infra/postgres/migrations/0032_f5_canonical_taxonomy.up.sql"
DOWN = ROOT / "infra/postgres/migrations/0032_f5_canonical_taxonomy.down.sql"


class F5CanonicalTaxonomyTests(unittest.TestCase):
    def setUp(self):
        self.up = UP.read_text(encoding="utf-8")
        self.down = DOWN.read_text(encoding="utf-8")

    def test_migration_is_linear_additive_and_preserves_historical_category(self):
        self.assertIn("0031_real_circuit_reference_data must be applied first", self.up)
        self.assertIn("create table disciplines", self.up)
        self.assertIn("create table discipline_families", self.up)
        self.assertIn("alter table championships add column discipline_key text", self.up)
        self.assertNotRegex(self.up, r"update\s+championships\s+set\s+discipline_key")
        self.assertNotIn("drop column category", self.up.lower())
        self.assertNotRegex(self.up.lower(), r"alter\s+table\s+events\s+rename")

    def test_session_types_registry_is_reused_and_extensible(self):
        self.assertNotIn("create table session_types", self.up.lower())
        for key in ("practice_1", "practice_2", "practice_3", "sprint_qualifying", "test", "stage", "special_stage"):
            self.assertIn(f"('{key}'", self.up)
        self.assertIn("not exists(select 1 from session_types where key=pair.value#>>'{}')", self.up)
        self.assertNotIn("<>all(array['practice'", self.up)

    def test_new_disciplines_and_families_are_rows_not_schema_changes(self):
        self.assertRegex(self.up, r"family_key text not null references discipline_families\(key\)")
        self.assertRegex(self.up, r"insert into discipline_families\(key,label,active\)")
        self.assertRegex(self.up, r"insert into disciplines\(key,label,family_key,active\)")
        self.assertNotRegex(self.up.lower(), r"create type .* enum")

    def test_rollback_refuses_to_destroy_referenced_taxonomy(self):
        self.assertIn("Refusing 0032 rollback while championships use canonical disciplines", self.down)
        self.assertIn("Refusing 0032 rollback while mappings use F5 session types", self.down)
        self.assertIn("Refusing 0032 rollback while historical sessions use F5 session types", self.down)
        self.assertIn("Refusing 0032 rollback while canonical Events use F5 session types", self.down)
        self.assertRegex(
            self.down,
            r"events where category in \('practice_1','practice_2','practice_3','sprint_qualifying','test','stage','special_stage'\)",
        )
        self.assertIn("'stage'", self.down)
        self.assertIn("'special_stage'", self.down)
        self.assertIn("Refusing 0032 rollback while disciplines contain custom data", self.down)
        self.assertIn("Refusing 0032 rollback while discipline families contain custom data", self.down)
        self.assertIn("Refusing 0032 rollback while F5 session types contain custom data", self.down)


if __name__ == "__main__":
    unittest.main()
