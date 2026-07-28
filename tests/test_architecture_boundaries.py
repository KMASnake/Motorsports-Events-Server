import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "server" / "app"


class ArchitectureBoundaryTests(unittest.TestCase):
    def test_layer_packages_exist(self):
        for package in ("domain", "application", "api", "infrastructure"):
            self.assertTrue((APP / package / "__init__.py").is_file(), package)

    def test_domain_does_not_import_frameworks(self):
        for source_file in (APP / "domain").glob("*.py"):
            source = source_file.read_text(encoding="utf-8")
            for dependency in ("fastapi", "sqlalchemy", "httpx"):
                self.assertNotIn(dependency, source, source_file.name)

    def test_legacy_import_modules_remain_available(self):
        for module in (
            "sync_service.py",
            "models.py",
            "database.py",
            "session_classification.py",
        ):
            self.assertTrue((APP / module).is_file(), module)


if __name__ == "__main__":
    unittest.main()
