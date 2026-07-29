from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session as OrmSession, joinedload

from ..domain.temporal_consistency import validate_temporal_range
from ..infrastructure.persistence.models import Event, ManualOverride, Session


def temporal_anomalies(
    db: OrmSession,
    limit: int = 200,
) -> list[Session]:
    return (
        db.query(Session)
        .options(joinedload(Session.event))
        .filter(Session.end_at < Session.start_at)
        .order_by(Session.start_at, Session.id)
        .limit(limit)
        .all()
    )


def correct_session_timing(
    db: OrmSession,
    session_id: int,
    start_at: datetime,
    end_at: datetime,
) -> Session:
    validate_temporal_range(start_at, end_at)

    session = (
        db.query(Session)
        .options(joinedload(Session.event))
        .filter(Session.id == session_id)
        .one_or_none()
    )
    if session is None:
        raise LookupError("Séance introuvable.")

    event: Event = session.event
    override = db.query(ManualOverride).filter_by(
        source=event.source,
        source_event_id=event.source_event_id,
        source_session_id=session.source_session_id,
    ).one_or_none()

    if override is None:
        override = ManualOverride(
            source=event.source,
            source_event_id=event.source_event_id,
            source_session_id=session.source_session_id,
            sport_id=event.sport_id,
        )

    if not override.original_data:
        override.original_data = {
            "event_name": event.name,
            "session_name": session.name,
            "start_at": session.start_at.isoformat(),
            "end_at": session.end_at.isoformat(),
            "status": session.status,
            "venue": event.venue or "",
            "city": event.city or "",
            "country": event.country or "",
            "round": event.round,
        }

    changes = dict(override.override_data or {})
    changes["start_at"] = start_at.isoformat()
    changes["end_at"] = end_at.isoformat()
    override.override_data = changes
    override.state = "active"
    override.active = True
    override.updated_at = datetime.now(timezone.utc)

    session.start_at = start_at
    session.end_at = end_at
    session.version += 1
    session.updated_at = datetime.now(timezone.utc)
    event.updated_at = datetime.now(timezone.utc)

    db.add(override)
    db.add(session)
    db.add(event)
    db.commit()
    db.refresh(session)
    return session
