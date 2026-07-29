import os
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

try:
    import alembic  # noqa: F401
    from alembic import command
    from sqlalchemy import create_engine, text

    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False


@unittest.skipUnless(
    DEPENDENCIES_AVAILABLE,
    "Alembic et SQLAlchemy ne sont pas installés.",
)
class SchemaMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("DATABASE_URL", "sqlite://")
        os.environ.setdefault("PROJECT_NAME", "Migration tests")
        os.environ.setdefault("ADMIN_API_KEY", "admin-key-for-tests")
        os.environ.setdefault("PUBLIC_API_KEY", "public-key-for-tests")

        global Base
        global upgrade_database

        from app.infrastructure.persistence import models  # noqa: F401
        from app.infrastructure.persistence.database import Base
        from app.schema_migrations import (
            alembic_config,
            upgrade_database,
        )

        cls.alembic_config = staticmethod(alembic_config)

    def test_fresh_database_is_created_at_head(self):
        with TemporaryDirectory() as directory:
            url = f"sqlite:///{Path(directory) / 'fresh.db'}"

            revision = upgrade_database(url)

            engine = create_engine(url)
            with engine.connect() as connection:
                tables = {
                    row[0]
                    for row in connection.execute(
                        text(
                            "SELECT name FROM sqlite_master "
                            "WHERE type = 'table'"
                        )
                    )
                }
                stored = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
            self.assertEqual(revision, stored)
            self.assertTrue(
                {
                    "sports",
                    "events",
                    "sessions",
                    "manual_overrides",
                    "sync_runs",
                    "admin_audit_logs",
                }.issubset(tables)
            )
            command.check(self.alembic_config(url))
            engine.dispose()

    def test_existing_2_6_schema_is_adopted_without_data_loss(self):
        with TemporaryDirectory() as directory:
            url = f"sqlite:///{Path(directory) / 'existing.db'}"
            engine = create_engine(url)
            Base.metadata.create_all(
                engine,
                tables=[
                    table
                    for table in Base.metadata.sorted_tables
                    if table.name != "admin_audit_logs"
                ],
            )
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO sports "
                        "(id, name, provider, enabled) "
                        "VALUES ('indycar', 'IndyCar', 'test', 1)"
                    )
                )

            revision = upgrade_database(url)

            with engine.connect() as connection:
                count = connection.execute(
                    text(
                        "SELECT count(*) FROM sports "
                        "WHERE id = 'indycar'"
                    )
                ).scalar_one()
                stored = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
                audit_table = connection.execute(
                    text(
                        "SELECT count(*) FROM sqlite_master "
                        "WHERE type = 'table' "
                        "AND name = 'admin_audit_logs'"
                    )
                ).scalar_one()
            self.assertEqual(1, count)
            self.assertEqual(revision, stored)
            self.assertEqual(1, audit_table)
            engine.dispose()

    def test_incomplete_existing_schema_is_refused(self):
        with TemporaryDirectory() as directory:
            url = f"sqlite:///{Path(directory) / 'invalid.db'}"
            engine = create_engine(url)
            with engine.begin() as connection:
                connection.execute(
                    text("CREATE TABLE sports (id VARCHAR(64) PRIMARY KEY)")
                )

            with self.assertRaisesRegex(
                RuntimeError,
                "Schéma existant incomplet",
            ):
                upgrade_database(url)
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
