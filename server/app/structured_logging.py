from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


STANDARD_FIELDS = set(logging.makeLogRecord({}).__dict__) | {
    "message",
    "asctime",
}
SENSITIVE_MARKERS = (
    "authorization",
    "cookie",
    "key",
    "password",
    "secret",
    "token",
)


def _sanitize(value: Any, field_name: str = "") -> Any:
    lowered = field_name.lower()
    if any(marker in lowered for marker in SENSITIVE_MARKERS):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {
            str(key): _sanitize(item, str(key))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_sanitize(item) for item in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


class JsonFormatter(logging.Formatter):
    def __init__(self, sensitive_values: tuple[str, ...] = ()) -> None:
        super().__init__()
        self.sensitive_values = tuple(
            value for value in sensitive_values if value and len(value) >= 6
        )

    def _redact_text(self, value: str) -> str:
        for secret in self.sensitive_values:
            value = value.replace(secret, "[REDACTED]")
        return value

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": getattr(record, "service", "server"),
            "event": getattr(record, "event", "log"),
            "message": self._redact_text(record.getMessage()),
        }
        for key, value in record.__dict__.items():
            if key not in STANDARD_FIELDS and key not in payload:
                payload[key] = _sanitize(value, key)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging(
    level: str = "INFO",
    service: str = "server",
    sensitive_values: tuple[str, ...] = (),
) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(sensitive_values))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    for name in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_logger.disabled = True

    logging.LoggerAdapter(
        logging.getLogger("motorsports.lifecycle"),
        {"service": service, "event": "logging.configured"},
    ).info("Structured logging configured")
