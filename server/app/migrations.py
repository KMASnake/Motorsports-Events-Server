from sqlalchemy import text

from .database import engine


def apply_runtime_migrations() -> None:
    statements = [
        """
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS category VARCHAR(32)
        NOT NULL DEFAULT 'non_race'
        """,
        """
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS is_race BOOLEAN
        NOT NULL DEFAULT FALSE
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_sessions_category
        ON sessions (category)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_sessions_is_race
        ON sessions (is_race)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_sessions_start_at
        ON sessions (start_at)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_events_sport_id
        ON events (sport_id)
        """,
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
