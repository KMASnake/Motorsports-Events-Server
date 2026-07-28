from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NormalizedSession:
    source_session_id: str
    name: str
    session_type: str
    start_at: datetime
    end_at: datetime
    status: str = "scheduled"


@dataclass
class NormalizedEvent:
    source: str
    source_event_id: str
    sport_id: str
    name: str
    round: int | None = None
    status: str = "scheduled"
    venue: str | None = None
    city: str | None = None
    country: str | None = None
    country_code: str | None = None
    sessions: list[NormalizedSession] = field(default_factory=list)
    raw_data: dict = field(default_factory=dict)
