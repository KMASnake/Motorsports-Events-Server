from copy import deepcopy
from datetime import datetime
from sqlalchemy.orm import Session as OrmSession
from .models import ManualOverride
from .providers.base import NormalizedEvent, NormalizedSession


def snapshot(event: NormalizedEvent, session: NormalizedSession) -> dict:
    return {
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


def resolve_state(original: dict, provider: dict, changes: dict) -> str:
    relevant = {
        key: value for key, value in changes.items()
        if key not in {"force_include", "force_exclude"}
    }
    if relevant and all(str(provider.get(k, "")) == str(v) for k, v in relevant.items()):
        return "provider_corrected"
    if any(str(provider.get(k, "")) != str(original.get(k, "")) for k in relevant):
        return "conflict"
    return "active"


def apply_override(
    db: OrmSession,
    event: NormalizedEvent,
    session: NormalizedSession,
):
    row = db.query(ManualOverride).filter_by(
        source=event.source,
        source_event_id=event.source_event_id,
        source_session_id=session.source_session_id,
        active=True,
    ).one_or_none()

    if row is None:
        return event, session, {}

    event = deepcopy(event)
    session = deepcopy(session)
    provider = snapshot(event, session)

    if not row.original_data:
        row.original_data = provider

    row.last_provider_data = provider
    row.state = resolve_state(row.original_data, provider, row.override_data)

    changes = row.override_data
    event.name = changes.get("event_name", event.name)
    session.name = changes.get("session_name", session.name)
    session.status = changes.get("status", session.status)
    event.venue = changes.get("venue", event.venue)
    event.city = changes.get("city", event.city)
    event.country = changes.get("country", event.country)
    event.round = changes.get("round", event.round)

    if changes.get("start_at"):
        session.start_at = datetime.fromisoformat(
            changes["start_at"].replace("Z", "+00:00")
        )
    if changes.get("end_at"):
        session.end_at = datetime.fromisoformat(
            changes["end_at"].replace("Z", "+00:00")
        )

    db.add(row)
    return event, session, changes
