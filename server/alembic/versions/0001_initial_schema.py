"""Create the initial versioned schema.

Revision ID: 0001_initial_schema
Revises:
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sports",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column(
            "enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column("icon_url", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("source_event_id", sa.String(length=191), nullable=False),
        sa.Column("sport_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("round", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=64),
            server_default="scheduled",
            nullable=False,
        ),
        sa.Column("venue", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("country", sa.String(length=128), nullable=True),
        sa.Column("country_code", sa.String(length=3), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["sport_id"], ["sports.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source",
            "source_event_id",
            name="uq_event_source",
        ),
    )
    op.create_index("ix_events_sport_id", "events", ["sport_id"])
    op.create_table(
        "manual_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("source_event_id", sa.String(length=191), nullable=False),
        sa.Column("source_session_id", sa.String(length=191), nullable=False),
        sa.Column("sport_id", sa.String(length=64), nullable=False),
        sa.Column("original_data", sa.JSON(), nullable=False),
        sa.Column("override_data", sa.JSON(), nullable=False),
        sa.Column("last_provider_data", sa.JSON(), nullable=False),
        sa.Column(
            "state",
            sa.String(length=32),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source",
            "source_event_id",
            "source_session_id",
            name="uq_override_source",
        ),
    )
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="running",
            nullable=False,
        ),
        sa.Column(
            "created",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "updated",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "errors",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("details", sa.Text(), server_default="", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("source_session_id", sa.String(length=191), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("session_type", sa.String(length=64), nullable=False),
        sa.Column(
            "category",
            sa.String(length=32),
            server_default="non_race",
            nullable=False,
        ),
        sa.Column(
            "is_race",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=64),
            server_default="scheduled",
            nullable=False,
        ),
        sa.Column(
            "deleted",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.Integer(),
            server_default="1",
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "source_session_id",
            name="uq_session_source",
        ),
    )
    op.create_index("ix_sessions_category", "sessions", ["category"])
    op.create_index("ix_sessions_is_race", "sessions", ["is_race"])
    op.create_index("ix_sessions_start_at", "sessions", ["start_at"])


def downgrade() -> None:
    op.drop_index("ix_sessions_start_at", table_name="sessions")
    op.drop_index("ix_sessions_is_race", table_name="sessions")
    op.drop_index("ix_sessions_category", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("sync_runs")
    op.drop_table("manual_overrides")
    op.drop_index("ix_events_sport_id", table_name="events")
    op.drop_table("events")
    op.drop_table("sports")
