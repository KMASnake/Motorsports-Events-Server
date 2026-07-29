from __future__ import annotations

import asyncio
import json
import os
import sys
import unittest
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")

try:
    import pytest
    from sqlalchemy import create_engine, inspect, text
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import sessionmaker

    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False


if DEPENDENCIES_AVAILABLE:
    postgres_test = pytest.mark.postgres
else:
    postgres_test = lambda target: target


def fixture_events():
    from app.domain.events import NormalizedEvent, NormalizedSession

    payload = json.loads(
        (ROOT / "tests" / "fixtures" / "indycar_events.json").read_text(
            encoding="utf-8"
        )
    )
    events = []
    for event in payload["events"]:
        sessions = [
            NormalizedSession(
                source_session_id=session["source_session_id"],
                name=session["name"],
                session_type=session["session_type"],
                start_at=datetime.fromisoformat(session["start_at"]),
                end_at=datetime.fromisoformat(session["end_at"]),
                status=session["status"],
            )
            for session in event["sessions"]
        ]
        events.append(
            NormalizedEvent(
                source=event["source"],
                source_event_id=event["source_event_id"],
                sport_id=event["sport_id"],
                name=event["name"],
                round=event["round"],
                status=event["status"],
                venue=event["venue"],
                city=event["city"],
                country=event["country"],
                country_code=event["country_code"],
                sessions=sessions,
                raw_data=event["raw_data"],
            )
        )
    return events


@contextmanager
def temporary_database():
    name = f"integration_{uuid4().hex}"
    admin_url = make_url(TEST_DATABASE_URL)
    database_url = admin_url.set(database=name).render_as_string(
        hide_password=False
    )
    admin_engine = create_engine(
        TEST_DATABASE_URL,
        isolation_level="AUTOCOMMIT",
    )
    with admin_engine.connect() as connection:
        connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
    try:
        yield database_url
    finally:
        with admin_engine.connect() as connection:
            connection.execute(
                text(
                    "SELECT pg_terminate_backend(pid) "
                    "FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ),
                {"name": name},
            )
            connection.exec_driver_sql(f'DROP DATABASE "{name}"')
        admin_engine.dispose()


@postgres_test
@unittest.skipUnless(
    DEPENDENCIES_AVAILABLE and TEST_DATABASE_URL,
    "TEST_DATABASE_URL et les dépendances PostgreSQL sont requis.",
)
class PostgreSqlIntegrationTests(unittest.TestCase):
    def test_fresh_database_migrates_to_head(self):
        from app.schema_migrations import upgrade_database

        with temporary_database() as database_url:
            revision = upgrade_database(database_url)
            engine = create_engine(database_url)
            try:
                self.assertEqual(
                    {
                        "alembic_version",
                        "events",
                        "manual_overrides",
                        "sessions",
                        "sports",
                        "sync_runs",
                    },
                    set(inspect(engine).get_table_names()),
                )
                with engine.connect() as connection:
                    stored = connection.execute(
                        text("SELECT version_num FROM alembic_version")
                    ).scalar_one()
                self.assertEqual("0001_initial_schema", revision)
                self.assertEqual(revision, stored)
            finally:
                engine.dispose()

    def test_existing_schema_is_adopted_without_data_loss(self):
        from app.infrastructure.persistence import models  # noqa: F401
        from app.infrastructure.persistence.database import Base
        from app.infrastructure.persistence.models import Sport
        from app.schema_migrations import upgrade_database

        with temporary_database() as database_url:
            engine = create_engine(database_url)
            try:
                Base.metadata.create_all(engine)
                SessionLocal = sessionmaker(bind=engine)
                with SessionLocal.begin() as db:
                    db.add(
                        Sport(
                            id="indycar",
                            name="IndyCar",
                            provider="fixture",
                        )
                    )

                revision = upgrade_database(database_url)

                with SessionLocal() as db:
                    sport = db.get(Sport, "indycar")
                    self.assertIsNotNone(sport)
                    self.assertEqual("IndyCar", sport.name)
                self.assertEqual("0001_initial_schema", revision)
            finally:
                engine.dispose()

    def test_synchronization_persists_fixture_and_override(self):
        from app.application.synchronization import synchronize
        from app.application.temporal_corrections import (
            correct_session_timing,
        )
        from app.infrastructure.persistence.models import (
            Event,
            ManualOverride,
            Session,
            Sport,
            SyncRun,
        )
        from app.providers.ocblacktop import OcBlackTopProvider
        from app.providers.thesportsdb import TheSportsDbProvider
        from app.schema_migrations import upgrade_database

        events = fixture_events()
        with temporary_database() as database_url:
            upgrade_database(database_url)
            engine = create_engine(database_url)
            SessionLocal = sessionmaker(
                bind=engine,
                expire_on_commit=False,
            )
            try:
                with SessionLocal() as db:
                    with (
                        patch.object(
                            OcBlackTopProvider,
                            "fetch",
                            new=AsyncMock(return_value=events),
                        ),
                        patch.object(
                            TheSportsDbProvider,
                            "fetch",
                            new=AsyncMock(return_value=[]),
                        ),
                    ):
                        first = asyncio.run(synchronize(db))

                    self.assertEqual("completed", first.status)
                    self.assertEqual(1, first.created)
                    self.assertEqual(1, db.query(Sport).count())
                    self.assertEqual(1, db.query(Event).count())
                    self.assertEqual(2, db.query(Session).count())
                    stored_event = db.query(Event).one()
                    self.assertTrue(stored_event.raw_data["fixture"])

                    warmup = db.query(Session).filter_by(
                        source_session_id="indycar-practice-1"
                    ).one()
                    corrected_end = warmup.end_at.replace(hour=14)
                    correct_session_timing(
                        db,
                        warmup.id,
                        warmup.start_at,
                        corrected_end,
                    )

                    with (
                        patch.object(
                            OcBlackTopProvider,
                            "fetch",
                            new=AsyncMock(return_value=events),
                        ),
                        patch.object(
                            TheSportsDbProvider,
                            "fetch",
                            new=AsyncMock(return_value=[]),
                        ),
                    ):
                        second = asyncio.run(synchronize(db))

                    db.expire_all()
                    persisted = db.get(Session, warmup.id)
                    self.assertEqual(corrected_end, persisted.end_at)
                    self.assertEqual(1, db.query(ManualOverride).count())
                    self.assertEqual(2, db.query(SyncRun).count())
                    self.assertEqual(1, second.updated)
                    self.assertEqual(0, second.errors)
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
