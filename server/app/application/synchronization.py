from datetime import datetime, timezone
import logging
from threading import Lock

from sqlalchemy import text
from sqlalchemy.orm import Session as OrmSession

from ..config import get_settings
from ..domain.session_classification import classify_session
from ..domain.sports import sport_display_name
from ..infrastructure.persistence.models import Event, Session, Sport, SyncRun
from ..overrides import apply_override
from ..providers.ocblacktop import OcBlackTopProvider
from ..providers.thesportsdb import TheSportsDbProvider

logger = logging.getLogger("motorsports.sync")
_local_sync_lock = Lock()
_POSTGRES_SYNC_LOCK_ID = 734_833_218


class SynchronizationInProgress(RuntimeError):
    """Raised when another API or scheduler process already owns the sync lock."""


def _mark_orphaned_runs(db: OrmSession) -> None:
    now = datetime.now(timezone.utc)
    for stale_run in db.query(SyncRun).filter(SyncRun.status == "running").all():
        stale_run.status = "interrupted"
        stale_run.finished_at = now
        stale_run.errors = max(stale_run.errors, 1)
        stale_run.details = "\n".join(
            part for part in (stale_run.details, "Synchronisation interrompue.") if part
        )
    db.commit()


async def synchronize(db: OrmSession) -> SyncRun:
    bind = db.get_bind()
    lock_connection = None
    local_lock_acquired = False

    if bind.dialect.name == "postgresql":
        lock_connection = bind.connect()
        acquired = bool(
            lock_connection.scalar(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": _POSTGRES_SYNC_LOCK_ID},
            )
        )
    else:
        local_lock_acquired = _local_sync_lock.acquire(blocking=False)
        acquired = local_lock_acquired

    if not acquired:
        if lock_connection is not None:
            lock_connection.close()
        raise SynchronizationInProgress(
            "Une synchronisation est déjà en cours."
        )

    try:
        _mark_orphaned_runs(db)
        return await _synchronize_locked(db)
    finally:
        if lock_connection is not None:
            lock_connection.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": _POSTGRES_SYNC_LOCK_ID},
            )
            lock_connection.close()
        elif local_lock_acquired:
            _local_sync_lock.release()


async def _synchronize_locked(db: OrmSession) -> SyncRun:
    settings = get_settings()
    run = SyncRun(status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    logger.info(
        "Synchronization started",
        extra={
            "event": "sync.started",
            "sync_run_id": run.id,
            "season": settings.sync_season,
        },
    )

    created = updated = errors = 0
    details: list[str] = []

    for provider in (OcBlackTopProvider(), TheSportsDbProvider()):
        try:
            provider_events = await provider.fetch(settings.sync_season)
        except Exception as exc:
            errors += 1
            details.append(f"{provider.name}: {exc}")
            logger.exception(
                "Provider synchronization failed",
                extra={
                    "event": "sync.provider_failed",
                    "sync_run_id": run.id,
                    "provider": provider.name,
                },
            )
            continue

        for source_event in provider_events:
            sport = db.get(Sport, source_event.sport_id)

            if sport is None:
                sport = Sport(
                    id=source_event.sport_id,
                    name=sport_display_name(source_event.sport_id),
                    provider=source_event.source,
                )
                db.add(sport)
                db.flush()

            event = db.query(Event).filter_by(
                source=source_event.source,
                source_event_id=source_event.source_event_id,
            ).one_or_none()

            if event is None:
                event = Event(
                    source=source_event.source,
                    source_event_id=source_event.source_event_id,
                    sport_id=source_event.sport_id,
                    name=source_event.name,
                )
                db.add(event)
                db.flush()
                created += 1
            else:
                updated += 1

            event.name = source_event.name
            event.round = source_event.round
            event.status = source_event.status
            event.venue = source_event.venue
            event.city = source_event.city
            event.country = source_event.country
            event.country_code = source_event.country_code
            event.raw_data = source_event.raw_data
            event.updated_at = datetime.now(timezone.utc)

            seen_session_ids: set[str] = set()

            for source_session in source_event.sessions:
                corrected_event, corrected_session, changes = apply_override(
                    db,
                    source_event,
                    source_session,
                )

                normalized_type, category, is_race = classify_session(
                    corrected_session.session_type,
                    corrected_session.name,
                )

                seen_session_ids.add(corrected_session.source_session_id)

                session = db.query(Session).filter_by(
                    event_id=event.id,
                    source_session_id=corrected_session.source_session_id,
                ).one_or_none()

                if session is None:
                    session = Session(
                        event_id=event.id,
                        source_session_id=corrected_session.source_session_id,
                        name=corrected_session.name,
                        session_type=normalized_type,
                        category=category,
                        is_race=is_race,
                        start_at=corrected_session.start_at,
                        end_at=corrected_session.end_at,
                        status=corrected_session.status,
                        deleted=bool(changes.get("force_exclude", False)),
                    )
                    db.add(session)
                else:
                    session.name = corrected_session.name
                    session.session_type = normalized_type
                    session.category = category
                    session.is_race = is_race
                    session.start_at = corrected_session.start_at
                    session.end_at = corrected_session.end_at
                    session.status = corrected_session.status
                    session.deleted = bool(changes.get("force_exclude", False))
                    session.version += 1
                    session.updated_at = datetime.now(timezone.utc)

                event.name = corrected_event.name
                event.round = corrected_event.round
                event.venue = corrected_event.venue
                event.city = corrected_event.city
                event.country = corrected_event.country

            # A session absent from the current provider payload is retained,
            # but marked deleted so clients may choose to exclude or audit it.
            for existing in event.sessions:
                if existing.source_session_id not in seen_session_ids:
                    existing.deleted = True
                    existing.version += 1
                    existing.updated_at = datetime.now(timezone.utc)

            db.commit()

    run.status = "completed" if errors == 0 else "completed_with_errors"
    run.finished_at = datetime.now(timezone.utc)
    run.created = created
    run.updated = updated
    run.errors = errors
    run.details = "\n".join(details)
    db.add(run)
    db.commit()
    db.refresh(run)
    logger.info(
        "Synchronization completed",
        extra={
            "event": "sync.completed",
            "sync_run_id": run.id,
            "status": run.status,
            "created_count": created,
            "updated_count": updated,
            "error_count": errors,
        },
    )
    return run
