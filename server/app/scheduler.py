import asyncio
import logging
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import get_settings
from .database import SessionLocal
from .schema_migrations import assert_schema_current
from .sync_service import synchronize
from .structured_logging import configure_logging

logging_settings = get_settings()
configure_logging(
    logging_settings.log_level,
    service="scheduler",
    sensitive_values=(
        logging_settings.admin_api_key,
        logging_settings.public_api_key,
        logging_settings.ocblacktop_api_key,
        logging_settings.thesportsdb_api_key,
    ),
)
logger = logging.getLogger("motorsport-calendar")

assert_schema_current()


def job():
    db = SessionLocal()
    try:
        run = asyncio.run(synchronize(db))
        logger.info(
            "Scheduled synchronization completed",
            extra={
                "service": "scheduler",
                "event": "sync.completed",
                "sync_run_id": run.id,
                "status": run.status,
                "created_count": run.created,
                "updated_count": run.updated,
                "error_count": run.errors,
            },
        )
    finally:
        db.close()


if __name__ == "__main__":
    settings = get_settings()
    scheduler = BlockingScheduler(timezone=settings.timezone)
    scheduler.add_job(
        job,
        "interval",
        minutes=settings.sync_interval_minutes,
        max_instances=1,
        coalesce=True,
    )
    job()
    scheduler.start()
