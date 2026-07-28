from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol


class SessionView(Protocol):
    start_at: datetime
    end_at: datetime
    session_type: str
    category: str
    status: str
    is_race: bool
    deleted: bool


def parse_csv_values(value: str) -> set[str]:
    return {item.strip() for item in value.split(",") if item.strip()}


@dataclass(frozen=True)
class EventFilters:
    from_date: datetime | None = None
    to_date: datetime | None = None
    season: int | None = None
    session_types: set[str] = field(default_factory=set)
    categories: set[str] = field(default_factory=set)
    statuses: set[str] = field(default_factory=set)
    is_race: bool | None = None
    include_cancelled: bool = True
    include_deleted: bool = False


def session_is_visible(session: SessionView, filters: EventFilters) -> bool:
    if not filters.include_deleted and session.deleted:
        return False
    if filters.from_date and session.end_at < filters.from_date:
        return False
    if filters.to_date and session.start_at > filters.to_date:
        return False
    if filters.season is not None and session.start_at.year != filters.season:
        return False
    if filters.session_types and session.session_type not in filters.session_types:
        return False
    if filters.categories and session.category not in filters.categories:
        return False
    if filters.statuses and session.status not in filters.statuses:
        return False
    if filters.is_race is not None and session.is_race is not filters.is_race:
        return False
    if (
        not filters.include_cancelled
        and session.status.lower()
        in {"cancelled", "canceled", "annulé", "annule"}
    ):
        return False
    return True
