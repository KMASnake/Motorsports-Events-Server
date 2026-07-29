import asyncio
import logging
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import get_settings
from .database import SessionLocal
from .schema_migrations import assert_schema_current
from .sync_service import synchronize

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger("motorsport-calendar")

assert_schema_current()


def job():
    db = SessionLocal()
    try:
        run = asyncio.run(synchronize(db))
        logger.info(
            "Synchronisation %s created=%s updated=%s errors=%s",
            run.status, run.created, run.updated, run.errors
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
