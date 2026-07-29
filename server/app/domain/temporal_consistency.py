from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def is_temporally_inconsistent(
    start_at: datetime,
    end_at: datetime,
) -> bool:
    return end_at < start_at


def parse_admin_datetime(value: str, timezone_name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("Date ou heure invalide.") from exc

    if parsed.tzinfo is None:
        try:
            parsed = parsed.replace(tzinfo=ZoneInfo(timezone_name))
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Fuseau horaire invalide.") from exc

    return parsed.astimezone(timezone.utc)


def validate_temporal_range(
    start_at: datetime,
    end_at: datetime,
) -> None:
    if is_temporally_inconsistent(start_at, end_at):
        raise ValueError(
            "La fin de la séance doit être postérieure ou égale au début."
        )


def format_admin_datetime(value: datetime, timezone_name: str) -> str:
    try:
        local_timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        local_timezone = timezone.utc

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(local_timezone).strftime("%Y-%m-%dT%H:%M:%S")
