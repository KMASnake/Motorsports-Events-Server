import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BOOTSTRAP = ROOT / "infra/postgres/init/001-bootstrap.sql"
UP = ROOT / "infra/postgres/migrations/0031_real_circuit_reference_data.up.sql"
DOWN = ROOT / "infra/postgres/migrations/0031_real_circuit_reference_data.down.sql"
MAPPING = ROOT / "infra/postgres/reference-data/ocblacktop-f1-v2.json"
SEPANG = "e1f7b92f-1920-4561-9a62-870cf7c5f8fe"


class RealReferenceDataTests(unittest.TestCase):
    def test_operational_bootstrap_contains_no_demo_business_objects(self):
        source = BOOTSTRAP.read_text(encoding="utf-8")
        self.assertNotIn("evt-001", source)
        self.assertNotIn("evt-002", source)
        self.assertIsNone(re.search(r"insert\s+into\s+(events|meetings)\b", source, re.I))

    def test_real_reference_migration_is_additive_and_preserves_existing_rows(self):
        up = UP.read_text(encoding="utf-8")
        down = DOWN.read_text(encoding="utf-8")
        self.assertIn("0030_lot57pf_normalization_mapping_persistence", up)
        self.assertIn("on conflict(id) do nothing", up.lower())
        for circuit in ("monza", "silverstone"):
            self.assertIn(f"('{circuit}'", up)
        self.assertIn("migration_0031_inserted_circuits", up)
        self.assertIn("migration_0031_inserted_circuits", down)
        self.assertIn("Refusing 0031 rollback", down)
        self.assertIsNone(re.search(r"insert\s+into\s+(events|meetings)\b", up, re.I))

    def test_ocblacktop_mapping_is_complete_but_leaves_incoherent_sepang_unmapped(self):
        mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
        self.assertEqual(set(mapping), {"championshipIds", "circuitIds", "sessionTypes", "statuses"})
        self.assertEqual(mapping["championshipIds"], {"formula1": "f1"})
        self.assertEqual(len(mapping["circuitIds"]), 24)
        self.assertEqual(mapping["circuitIds"]["6c6c3380-e4f0-4b5d-b84d-47bf8e50c324"], "monza")
        self.assertEqual(mapping["circuitIds"]["2d8e0ba8-2e48-4914-88cf-8025661b3b47"], "silverstone")
        self.assertEqual(mapping["circuitIds"]["10358903-f251-4a40-8301-8966c208d860"], "yas-marina")
        self.assertEqual(mapping["circuitIds"]["d98e6a2a-ab3c-494f-b083-c68c0cffef32"], "albert-park")
        self.assertNotIn(SEPANG, mapping["circuitIds"])
        self.assertEqual(mapping["statuses"], {"scheduled": "scheduled", "cancelled": "cancelled", "completed": "completed"})
        for value in ("practice", "qualifying", "sprint", "sprint_qualifying", "race"):
            self.assertEqual(mapping["sessionTypes"][value], value)


if __name__ == "__main__":
    unittest.main()
