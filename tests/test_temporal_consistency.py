import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app.domain.temporal_consistency import (  # noqa: E402
    format_admin_datetime,
    is_temporally_inconsistent,
    parse_admin_datetime,
    validate_temporal_range,
)


class TemporalConsistencyTests(unittest.TestCase):
    def test_end_before_start_is_inconsistent(self):
        start = datetime(2026, 4, 19, 17, tzinfo=timezone.utc)
        end = datetime(2026, 4, 18, 18, tzinfo=timezone.utc)

        self.assertTrue(is_temporally_inconsistent(start, end))
        with self.assertRaises(ValueError):
            validate_temporal_range(start, end)

    def test_equal_start_and_end_is_allowed(self):
        value = datetime(2026, 7, 28, 12, tzinfo=timezone.utc)

        self.assertFalse(is_temporally_inconsistent(value, value))
        validate_temporal_range(value, value)

    def test_admin_datetime_uses_configured_timezone(self):
        parsed = parse_admin_datetime(
            "2026-07-28T14:30:00",
            "Europe/Paris",
        )

        self.assertEqual(
            parsed,
            datetime(2026, 7, 28, 12, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(
            format_admin_datetime(parsed, "Europe/Paris"),
            "2026-07-28T14:30:00",
        )


if __name__ == "__main__":
    unittest.main()
