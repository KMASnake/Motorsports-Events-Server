from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from sqlalchemy import BigInteger, and_, cast, func, or_
from sqlalchemy.orm import Session as OrmSession, joinedload

from .admin import router as admin_router
from .api.client_contract import (
    MAX_CURSOR_ID,
    InvalidCursor,
    change_payload,
    decode_cursor,
    encode_cursor,
    epoch_microseconds,
    event_payload,
    normalize_utc,
)
from .api.event_filters import EventFilters, parse_csv_values, session_is_visible
from .api.schemas import (
    ChangeFeedResponse,
    EventResponse,
    HealthResponse,
    SportResponse,
    VersionResponse,
)
from .config import get_settings
from .database import get_db
from .models import Event, Session, Sport, SyncRun
from .schema_migrations import assert_schema_current
from .security import require_public_key
from .version_info import version_payload

settings = get_settings()
assert_schema_current()

app = FastAPI(
    title=f"{settings.project_name} API",
    version="2.7.0-alpha.4",
    description=(
        f"Serveur central de {settings.project_name}. "
        "Le contrat /api/v1 reste rétrocompatible pendant toute la série 2.x."
    ),
)


app.include_router(admin_router)

@app.get("/")
def root():
    return {
        "name": settings.project_name,
        "version": "2.7.0-alpha.4",
        "docs": "/docs",
        "admin": "/admin",
    }



@app.get("/api/v1/version", response_model=VersionResponse)
def api_version():
    return version_payload()


@app.get("/api/v1/health", response_model=HealthResponse)
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc)}


@app.get(
    "/api/v1/sports",
    dependencies=[Depends(require_public_key)],
    response_model=list[SportResponse],
)
def sports(db: OrmSession = Depends(get_db)):
    return db.query(Sport).filter_by(enabled=True).order_by(Sport.name).all()


@app.get(
    "/api/v1/events",
    dependencies=[Depends(require_public_key)],
    response_model=list[EventResponse],
)
def events(
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
    sports: str = "",
    season: int | None = None,
    session_types: str = "",
    categories: str = "",
    statuses: str = "",
    is_race: bool | None = None,
    include_cancelled: bool = True,
    include_deleted: bool = False,
    db: OrmSession = Depends(get_db),
):
    session_query = db.query(
        Session.event_id.label("event_id"),
        func.min(Session.start_at).label("first_start"),
    )

    if not include_deleted:
        session_query = session_query.filter(Session.deleted.is_(False))

    if from_date:
        session_query = session_query.filter(Session.end_at >= from_date)

    if to_date:
        session_query = session_query.filter(Session.start_at <= to_date)

    if season is not None:
        session_query = session_query.filter(
            func.extract("year", Session.start_at) == season
        )

    if session_types:
        session_query = session_query.filter(
            Session.session_type.in_(
                [item.strip() for item in session_types.split(",") if item.strip()]
            )
        )

    if categories:
        session_query = session_query.filter(
            Session.category.in_(
                [item.strip() for item in categories.split(",") if item.strip()]
            )
        )

    if statuses:
        session_query = session_query.filter(
            Session.status.in_(
                [item.strip() for item in statuses.split(",") if item.strip()]
            )
        )

    if is_race is not None:
        session_query = session_query.filter(Session.is_race.is_(is_race))

    if not include_cancelled:
        session_query = session_query.filter(
            func.lower(Session.status).notin_(
                ["cancelled", "canceled", "annulé", "annule"]
            )
        )

    matching_sessions = session_query.group_by(Session.event_id).subquery()
    query = (
        db.query(Event)
        .options(joinedload(Event.sessions))
        .join(
            matching_sessions,
            matching_sessions.c.event_id == Event.id,
        )
    )

    if sports:
        query = query.filter(
            Event.sport_id.in_(
                [item.strip() for item in sports.split(",") if item.strip()]
            )
        )

    rows = query.order_by(matching_sessions.c.first_start, Event.id).all()

    event_filters = EventFilters(
        from_date=from_date,
        to_date=to_date,
        season=season,
        session_types=parse_csv_values(session_types),
        categories=parse_csv_values(categories),
        statuses=parse_csv_values(statuses),
        is_race=is_race,
        include_cancelled=include_cancelled,
        include_deleted=include_deleted,
    )

    result = []

    for event in rows:
        visible_sessions = [
            session
            for session in event.sessions
            if session_is_visible(session, event_filters)
        ]

        if not visible_sessions:
            continue

        result.append(event_payload(event, visible_sessions))

    return result


@app.get(
    "/api/v1/events/changes",
    dependencies=[Depends(require_public_key)],
    response_model=ChangeFeedResponse,
)
def changes(
    since: datetime | None = Query(
        default=None,
        description="Compatibilité historique : date ISO 8601 du dernier appel.",
    ),
    cursor: str | None = Query(
        default=None,
        description="Curseur opaque retourné par l'appel précédent.",
    ),
    limit: int = Query(default=500, ge=1, le=1000),
    db: OrmSession = Depends(get_db),
):
    if since is None and cursor is None:
        raise HTTPException(
            status_code=422,
            detail="Le paramètre since ou cursor est obligatoire.",
        )
    if since is not None and cursor is not None:
        raise HTTPException(
            status_code=422,
            detail="Utilisez since ou cursor, pas les deux.",
        )

    latest_sync = db.query(SyncRun).order_by(SyncRun.id.desc()).first()
    sync_run_id = latest_sync.id if latest_sync is not None else 0

    if latest_sync is not None and latest_sync.status == "running":
        raise HTTPException(
            status_code=503,
            detail="Synchronisation en cours. Réessayez dans quelques instants.",
            headers={"Retry-After": "10"},
        )

    if cursor is not None:
        try:
            boundary = decode_cursor(cursor)
        except InvalidCursor as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if boundary.sync_run_id != sync_run_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Le curseur a été invalidé par une synchronisation. "
                    "Recommencez depuis le dernier since confirmé."
                ),
            )
        snapshot_at = boundary.snapshot_at
        updated_epoch = cast(
            func.extract("epoch", Session.updated_at) * 1_000_000,
            BigInteger,
        )
        boundary_epoch = epoch_microseconds(boundary.updated_at)
        snapshot_epoch = epoch_microseconds(snapshot_at)
        query = db.query(Session).filter(updated_epoch <= snapshot_epoch)
        query = query.filter(
            or_(
                updated_epoch > boundary_epoch,
                and_(
                    updated_epoch == boundary_epoch,
                    Session.id > boundary.row_id,
                ),
            )
        )
    else:
        snapshot_at = datetime.now(timezone.utc)
        updated_epoch = cast(
            func.extract("epoch", Session.updated_at) * 1_000_000,
            BigInteger,
        )
        query = db.query(Session).filter(
            updated_epoch <= epoch_microseconds(snapshot_at)
        )
        query = query.filter(
            updated_epoch > epoch_microseconds(since)
        )

    rows = query.order_by(updated_epoch, Session.id).limit(limit + 1).all()

    current_sync = db.query(SyncRun).order_by(SyncRun.id.desc()).first()
    current_sync_run_id = current_sync.id if current_sync is not None else 0
    if (
        current_sync_run_id != sync_run_id
        or (current_sync is not None and current_sync.status == "running")
    ):
        raise HTTPException(
            status_code=503,
            detail="Synchronisation démarrée pendant la lecture. Réessayez.",
            headers={"Retry-After": "10"},
        )
    has_more = len(rows) > limit
    page = rows[:limit]

    if has_more and page:
        next_at = normalize_utc(page[-1].updated_at)
        next_id = page[-1].id
    else:
        next_at = snapshot_at
        next_id = MAX_CURSOR_ID

    return {
        "updated": [change_payload(row) for row in page],
        "next_cursor": next_at,
        "cursor": encode_cursor(
            next_at,
            next_id,
            snapshot_at,
            sync_run_id,
        ),
        "has_more": has_more,
        "snapshot_at": snapshot_at,
    }
