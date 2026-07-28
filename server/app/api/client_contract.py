from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from datetime import datetime, timezone


MAX_CURSOR_ID = 2**63 - 1
UNIX_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


class InvalidCursor(ValueError):
    """Raised when a client cursor cannot be decoded safely."""


@dataclass(frozen=True)
class ChangeCursor:
    updated_at: datetime
    row_id: int
    snapshot_at: datetime
    sync_run_id: int | None


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def epoch_microseconds(value: datetime) -> int:
    delta = normalize_utc(value) - UNIX_EPOCH
    return (
        delta.days * 86_400_000_000
        + delta.seconds * 1_000_000
        + delta.microseconds
    )


def encode_cursor(
    updated_at: datetime,
    row_id: int,
    snapshot_at: datetime,
    sync_run_id: int,
) -> str:
    timestamp = normalize_utc(updated_at).isoformat().replace("+00:00", "Z")
    snapshot = normalize_utc(snapshot_at).isoformat().replace("+00:00", "Z")
    raw = f"{timestamp}|{row_id}|{snapshot}|{sync_run_id}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> ChangeCursor:
    try:
        padding = "=" * (-len(value) % 4)
        raw = base64.b64decode(
            value + padding,
            altchars=b"-_",
            validate=True,
        ).decode("utf-8")
        parts = raw.split("|")
        if len(parts) == 3:
            timestamp, row_id, snapshot = parts
            sync_run_id = None
        elif len(parts) == 4:
            timestamp, row_id, snapshot, raw_sync_run_id = parts
            sync_run_id = int(raw_sync_run_id)
        else:
            raise ValueError("invalid cursor fields")
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        parsed_snapshot = datetime.fromisoformat(
            snapshot.replace("Z", "+00:00")
        )
        parsed_id = int(row_id)
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise InvalidCursor("Curseur de synchronisation invalide.") from exc

    if (
        parsed_id < 0
        or parsed_id > MAX_CURSOR_ID
        or (sync_run_id is not None and sync_run_id < 0)
    ):
        raise InvalidCursor("Curseur de synchronisation invalide.")

    return ChangeCursor(
        normalize_utc(parsed),
        parsed_id,
        normalize_utc(parsed_snapshot),
        sync_run_id,
    )


def session_payload(session: object) -> dict:
    return {
        "id": session.id,
        "source_session_id": session.source_session_id,
        "name": session.name,
        "session_type": session.session_type,
        "category": session.category,
        "is_race": session.is_race,
        "start_at": session.start_at,
        "end_at": session.end_at,
        "status": session.status,
        "deleted": session.deleted,
        "version": session.version,
        "updated_at": session.updated_at,
    }


def event_payload(event: object, sessions: list[object]) -> dict:
    return {
        "id": event.id,
        "source": event.source,
        "source_event_id": event.source_event_id,
        "sport_id": event.sport_id,
        "name": event.name,
        "round": event.round,
        "status": event.status,
        "venue": event.venue,
        "city": event.city,
        "country": event.country,
        "country_code": event.country_code,
        "updated_at": event.updated_at,
        "sessions": [session_payload(session) for session in sessions],
    }


def change_payload(session: object) -> dict:
    return {
        "id": session.id,
        "event_id": session.event_id,
        **{
            key: value
            for key, value in session_payload(session).items()
            if key != "id"
        },
    }
