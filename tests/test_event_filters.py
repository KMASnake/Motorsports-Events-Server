import sys
import unittest
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app.api.event_filters import (  # noqa: E402
    EventFilters,
    parse_csv_values,
    session_is_visible,
)


@dataclass
class FakeSession:
    start_at: datetime
    end_at: datetime
    session_type: str = "race"
    category: str = "race"
    status: str = "scheduled"
    is_race: bool = True
    deleted: bool = False


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


class EventFilterRegressionTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession(
            start_at=dt("2026-07-04T13:00:00"),
            end_at=dt("2026-07-04T14:00:00"),
        )

    def test_empty_csv_values_are_ignored(self):
        self.assertEqual(parse_csv_values("race, sprint,,"), {"race", "sprint"})

    def test_unfiltered_session_remains_visible(self):
        self.assertTrue(session_is_visible(self.session, EventFilters()))

    def test_season_filter_excludes_other_years(self):
        self.assertFalse(session_is_visible(self.session, EventFilters(season=2025)))

    def test_race_filter_keeps_sprint_category(self):
        sprint = FakeSession(
            start_at=self.session.start_at,
            end_at=self.session.end_at,
            session_type="sprint",
            category="race",
            is_race=True,
        )
        self.assertTrue(session_is_visible(sprint, EventFilters(is_race=True)))

    def test_cancelled_filter_is_preserved(self):
        self.session.status = "cancelled"
        self.assertFalse(
            session_is_visible(self.session, EventFilters(include_cancelled=False))
        )

    def test_deleted_sessions_are_hidden_by_default(self):
        self.session.deleted = True
        self.assertFalse(session_is_visible(self.session, EventFilters()))
        self.assertTrue(
            session_is_visible(self.session, EventFilters(include_deleted=True))
        )


if __name__ == "__main__":
    unittest.main()
