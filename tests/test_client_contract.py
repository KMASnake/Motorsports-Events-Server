import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from server.app.api.client_contract import (
    InvalidCursor,
    change_payload,
    decode_cursor,
    encode_cursor,
    epoch_microseconds,
    event_payload,
)


NOW = datetime(2026, 7, 28, 12, 30, tzinfo=timezone.utc)


def sample_session(**overrides):
    values = {
        "id": 7,
        "event_id": 3,
        "source_session_id": "race",
        "name": "Race",
        "session_type": "race",
        "category": "race",
        "is_race": True,
        "start_at": NOW,
        "end_at": NOW,
        "status": "scheduled",
        "deleted": False,
        "version": 2,
        "updated_at": NOW,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class ClientContractTests(unittest.TestCase):
    def test_cursor_round_trip_preserves_boundary_and_snapshot(self):
        snapshot = datetime(2026, 7, 28, 12, 31, tzinfo=timezone.utc)
        encoded = encode_cursor(NOW, 42, snapshot, 17)
        decoded = decode_cursor(encoded)

        self.assertEqual(decoded.updated_at, NOW)
        self.assertEqual(decoded.row_id, 42)
        self.assertEqual(decoded.snapshot_at, snapshot)
        self.assertEqual(decoded.sync_run_id, 17)

    def test_legacy_cursor_has_no_sync_generation(self):
        encoded = (
            "MjAyNi0wNy0yOFQxMjozMDowMFp8NDJ8"
            "MjAyNi0wNy0yOFQxMjozMTowMFo"
        )
        decoded = decode_cursor(encoded)

        self.assertIsNone(decoded.sync_run_id)

    def test_invalid_cursor_is_rejected(self):
        with self.assertRaises(InvalidCursor):
            decode_cursor("not-a-valid-cursor")

    def test_epoch_key_is_timezone_independent(self):
        same_in_paris = datetime.fromisoformat("2026-07-28T14:30:00+02:00")

        self.assertEqual(
            epoch_microseconds(NOW),
            epoch_microseconds(same_in_paris),
        )
        self.assertEqual(
            epoch_microseconds(NOW.replace(tzinfo=None)),
            epoch_microseconds(NOW),
        )

    def test_session_change_fields_are_stable(self):
        self.assertEqual(
            set(change_payload(sample_session())),
            {
                "id",
                "event_id",
                "source_session_id",
                "name",
                "session_type",
                "category",
                "is_race",
                "start_at",
                "end_at",
                "status",
                "deleted",
                "version",
                "updated_at",
            },
        )

    def test_event_fields_are_stable(self):
        event = SimpleNamespace(
            id=3,
            source="provider",
            source_event_id="event-3",
            sport_id="formula-1",
            name="Grand Prix",
            round=1,
            status="scheduled",
            venue="Circuit",
            city="Paris",
            country="France",
            country_code="FRA",
            updated_at=NOW,
        )

        self.assertEqual(
            set(event_payload(event, [sample_session()])),
            {
                "id",
                "source",
                "source_event_id",
                "sport_id",
                "name",
                "round",
                "status",
                "venue",
                "city",
                "country",
                "country_code",
                "updated_at",
                "sessions",
            },
        )


if __name__ == "__main__":
    unittest.main()
