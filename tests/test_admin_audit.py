import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False


class AdminAuditTests(unittest.TestCase):
    @unittest.skipUnless(DEPENDENCIES_AVAILABLE, "SQLAlchemy est requis.")
    def test_admin_action_is_persisted_without_secret(self):
        os.environ.setdefault("DATABASE_URL", "sqlite://")
        os.environ.setdefault("PROJECT_NAME", "Audit tests")
        os.environ.setdefault("ADMIN_API_KEY", "admin-key-for-audit-tests")
        os.environ.setdefault("PUBLIC_API_KEY", "public-key-for-audit-tests")

        from app.admin.audit import record_admin_action
        from app.infrastructure.persistence.database import Base
        from app.infrastructure.persistence.models import AdminAuditLog

        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            record_admin_action(
                db,
                "settings.update",
                details={"fields": ["LOG_LEVEL", "ADMIN_API_KEY"]},
            )
            row = db.query(AdminAuditLog).one()

            self.assertEqual("settings.update", row.action)
            self.assertEqual("success", row.status)
            self.assertEqual(
                {"fields": ["LOG_LEVEL", "ADMIN_API_KEY"]},
                row.details,
            )
            self.assertNotIn("admin-key-for-audit-tests", str(row.details))
            self.assertNotIn("public-key-for-audit-tests", str(row.details))
        engine.dispose()

    def test_sensitive_admin_actions_are_instrumented(self):
        core = (
            ROOT / "server" / "app" / "admin" / "core.py"
        ).read_text(encoding="utf-8")
        extension = (
            ROOT / "server" / "app" / "admin_extension.py"
        ).read_text(encoding="utf-8")

        for action in {
            "auth.login",
            "sync.run",
            "override.save",
            "override.delete",
        }:
            self.assertIn(f'"{action}"', core)

        for action in {
            "settings.update",
            "temporal_issue.correct",
            "providers.test",
        }:
            self.assertIn(f'"{action}"', extension)

        self.assertIn('details={"fields": sorted(updates)}', extension)
