import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "infra" / "postgres" / "migrations"
SCHEMA_CONTRACT = ROOT / "apps" / "api" / "src" / "lib" / "schemaCompatibility.ts"


class NodeSchemaMigrationGraphTests(unittest.TestCase):
    def setUp(self):
        self.up_files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9][0-9]_*.up.sql"))
        self.versions = [path.name.removesuffix(".up.sql") for path in self.up_files]

    def test_graph_is_linear_complete_and_has_one_head(self):
        numbers = [int(version[:4]) for version in self.versions]
        self.assertEqual(list(range(1, 35)), numbers)
        self.assertEqual(len(self.versions), len(set(self.versions)))
        self.assertEqual("0034_f5_canonical_venues", self.versions[-1])
        for path, version in zip(self.up_files, self.versions, strict=True):
            sql = path.read_text(encoding="utf-8")
            self.assertIsNotNone(
                re.search(
                    rf"insert\s+into\s+schema_migrations\s*\([^)]*version[^)]*\).*?{re.escape(version)}",
                    sql,
                    re.IGNORECASE | re.DOTALL,
                ),
                path.name,
            )

    def test_application_contract_matches_every_migration(self):
        contract = SCHEMA_CONTRACT.read_text(encoding="utf-8")
        declared_block = contract.split("APPLICATION_SCHEMA_MIGRATIONS = [", 1)[1].split("] as const", 1)[0]
        declared = re.findall(r"'([0-9]{4}_[a-z0-9_]+)'", declared_block)
        self.assertEqual(self.versions, declared)
        self.assertIn("APPLICATION_SCHEMA_HEAD = APPLICATION_SCHEMA_MIGRATIONS.at(-1)", contract)

    def test_guard_is_observational_and_runner_remains_separate(self):
        guard = SCHEMA_CONTRACT.read_text(encoding="utf-8")
        database = (ROOT / "apps" / "api" / "src" / "lib" / "db.ts").read_text(encoding="utf-8")
        runner = (MIGRATIONS / "migrate.sh").read_text(encoding="utf-8")
        self.assertNotIn("insert into schema_migrations", guard.lower())
        self.assertNotIn("delete from schema_migrations", guard.lower())
        self.assertNotIn("migrate.sh", database)
        self.assertIn("select version from schema_migrations order by version", database)
        self.assertIn("version text primary key", runner)


if __name__ == "__main__":
    unittest.main()
