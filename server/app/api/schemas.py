from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    provider: str
    enabled: bool
    icon_url: str | None


class SessionResponse(BaseModel):
    id: int
    source_session_id: str
    name: str
    session_type: str
    category: str
    is_race: bool
    start_at: datetime
    end_at: datetime
    status: str
    deleted: bool
    version: int
    updated_at: datetime


class EventResponse(BaseModel):
    id: int
    source: str
    source_event_id: str
    sport_id: str
    name: str
    round: int | None
    status: str
    venue: str | None
    city: str | None
    country: str | None
    country_code: str | None
    updated_at: datetime
    sessions: list[SessionResponse]


class SessionChangeResponse(SessionResponse):
    event_id: int


class ChangeFeedResponse(BaseModel):
    updated: list[SessionChangeResponse]
    next_cursor: datetime
    cursor: str = Field(
        description="Curseur opaque à transmettre à la requête suivante.",
    )
    has_more: bool
    snapshot_at: datetime


class VersionResponse(BaseModel):
    version: str
    build: str
    git_commit: str


class HealthResponse(BaseModel):
    status: str
    time: datetime
