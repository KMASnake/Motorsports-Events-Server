import json
import logging
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app.structured_logging import JsonFormatter


class StructuredLoggingTests(unittest.TestCase):
    def test_formatter_outputs_json_with_context(self):
        record = logging.LogRecord(
            "motorsports.test",
            logging.INFO,
            __file__,
            1,
            "Synchronization completed",
            (),
            None,
        )
        record.service = "scheduler"
        record.event = "sync.completed"
        record.sync_run_id = 42
        record.errors = 0

        payload = json.loads(JsonFormatter().format(record))

        self.assertEqual("INFO", payload["level"])
        self.assertEqual("scheduler", payload["service"])
        self.assertEqual("sync.completed", payload["event"])
        self.assertEqual(42, payload["sync_run_id"])
        self.assertEqual(0, payload["errors"])
        self.assertIn("timestamp", payload)

    def test_formatter_redacts_sensitive_fields_recursively(self):
        record = logging.LogRecord(
            "motorsports.test",
            logging.INFO,
            __file__,
            1,
            "Sensitive values",
            (),
            None,
        )
        record.api_key = "never-log-this"
        record.context = {
            "authorization": "Bearer secret",
            "safe": "visible",
            "nested": {"password": "hidden"},
        }

        rendered = JsonFormatter().format(record)
        payload = json.loads(rendered)

        self.assertNotIn("never-log-this", rendered)
        self.assertNotIn("Bearer secret", rendered)
        self.assertEqual("[REDACTED]", payload["api_key"])
        self.assertEqual("[REDACTED]", payload["context"]["authorization"])
        self.assertEqual("visible", payload["context"]["safe"])
        self.assertEqual(
            "[REDACTED]",
            payload["context"]["nested"]["password"],
        )

    def test_formatter_redacts_known_secret_from_message(self):
        record = logging.LogRecord(
            "httpx",
            logging.INFO,
            __file__,
            1,
            "GET https://provider.test/api/known-secret-value/events",
            (),
            None,
        )

        rendered = JsonFormatter(("known-secret-value",)).format(record)

        self.assertNotIn("known-secret-value", rendered)
        self.assertIn("[REDACTED]", json.loads(rendered)["message"])

    def test_uvicorn_plain_access_log_is_disabled(self):
        dockerfile = (
            ROOT / "server" / "Dockerfile"
        ).read_text(encoding="utf-8")
        self.assertIn("--no-access-log", dockerfile)

    def test_sync_context_does_not_use_reserved_log_record_fields(self):
        reserved = set(logging.makeLogRecord({}).__dict__)
        synchronization = (
            ROOT / "server" / "app" / "application" / "synchronization.py"
        ).read_text(encoding="utf-8")
        scheduler = (
            ROOT / "server" / "app" / "scheduler.py"
        ).read_text(encoding="utf-8")

        self.assertIn('"created_count":', synchronization)
        self.assertIn('"updated_count":', synchronization)
        self.assertIn('"error_count":', synchronization)
        for name in ("created", "thread", "process", "module"):
            self.assertIn(name, reserved)
            self.assertNotIn(f'"{name}": run.', scheduler)
