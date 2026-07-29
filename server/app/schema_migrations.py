from __future__ import annotations

import argparse
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Connection, Engine

from .config import get_settings


SERVER_ROOT = Path(__file__).resolve().parent.parent
REQUIRED_SCHEMA = {
    "sports": {
        "id",
        "name",
        "provider",
        "enabled",
        "icon_url",
    },
    "events": {
        "id",
        "source",
        "source_event_id",
        "sport_id",
        "name",
        "round",
        "status",
        "venue",
        "city",
        "country",
        "country_code",
        "raw_data",
        "updated_at",
        "created_at",
    },
    "sessions": {
        "id",
        "event_id",
        "source_session_id",
        "name",
        "session_type",
        "category",
        "is_race",
        "start_at",
        "end_at",
        "status",
        "deleted",
        "version",
        "updated_at",
        "created_at",
    },
    "manual_overrides": {
        "id",
        "source",
        "source_event_id",
        "source_session_id",
        "sport_id",
        "original_data",
        "override_data",
        "last_provider_data",
        "state",
        "active",
        "updated_at",
        "created_at",
    },
    "sync_runs": {
        "id",
        "started_at",
        "finished_at",
        "status",
        "created",
        "updated",
        "errors",
        "details",
    },
}


def alembic_config(database_url: str) -> Config:
    config = Config(str(SERVER_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def expected_revision(config: Config) -> str:
    heads = ScriptDirectory.from_config(config).get_heads()
    if len(heads) != 1:
        raise RuntimeError(
            "Une seule révision Alembic de tête est attendue."
        )
    return heads[0]


def database_revision(connection: Connection) -> str | None:
    return MigrationContext.configure(connection).get_current_revision()


def validate_existing_schema(connection: Connection) -> None:
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    missing_tables = set(REQUIRED_SCHEMA) - tables
    if missing_tables:
        names = ", ".join(sorted(missing_tables))
        raise RuntimeError(
            f"Schéma existant incomplet, tables absentes : {names}."
        )

    missing_columns: list[str] = []
    for table, expected_columns in REQUIRED_SCHEMA.items():
        actual = {
            column["name"] for column in inspector.get_columns(table)
        }
        for column in sorted(expected_columns - actual):
            missing_columns.append(f"{table}.{column}")
    if missing_columns:
        names = ", ".join(missing_columns)
        raise RuntimeError(
            f"Schéma existant incomplet, colonnes absentes : {names}."
        )


def upgrade_database(database_url: str | None = None) -> str:
    url = database_url or get_settings().database_url
    config = alembic_config(url)
    expected = expected_revision(config)
    migration_engine = create_engine(url, pool_pre_ping=True)

    with migration_engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        revision = database_revision(connection)

    if tables and revision is None:
        with migration_engine.connect() as connection:
            validate_existing_schema(connection)
        command.stamp(config, expected)
    else:
        command.upgrade(config, "head")

    assert_schema_current(database_url=url, engine=migration_engine)
    migration_engine.dispose()
    return expected


def assert_schema_current(
    database_url: str | None = None,
    engine: Engine | None = None,
) -> str:
    url = database_url or get_settings().database_url
    config = alembic_config(url)
    expected = expected_revision(config)
    check_engine = engine or create_engine(url, pool_pre_ping=True)

    with check_engine.connect() as connection:
        current = database_revision(connection)

    if engine is None:
        check_engine.dispose()
    if current != expected:
        raise RuntimeError(
            "Version de schéma incorrecte : "
            f"attendue {expected}, trouvée {current or 'aucune'}."
        )
    return current


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("upgrade", "check"))
    args = parser.parse_args()

    revision = (
        upgrade_database()
        if args.action == "upgrade"
        else assert_schema_current()
    )
    print(f"Révision du schéma : {revision}")


if __name__ == "__main__":
    main()
