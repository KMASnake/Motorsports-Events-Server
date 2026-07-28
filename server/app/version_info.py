from __future__ import annotations

import os
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = APP_ROOT.parent


def read_text_file(name: str, default: str = "unknown") -> str:
    candidates = [
        PROJECT_ROOT / name,
        APP_ROOT / name,
        Path("/") / name,
    ]

    for path in candidates:
        try:
            if path.exists():
                return path.read_text(encoding="utf-8").strip() or default
        except OSError:
            continue

    return default


def version_payload() -> dict:
    return {
        "version": os.getenv("APP_VERSION", read_text_file("VERSION", "2.5.2")),
        "build": os.getenv("APP_BUILD", read_text_file("BUILD", "unknown")),
        "git_commit": os.getenv(
            "APP_GIT_COMMIT",
            read_text_file("GIT_COMMIT", "unknown"),
        ),
    }
