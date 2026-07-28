from __future__ import annotations

import re


RACE_TYPES = {
    "race",
    "sprint",
    "sprint_race",
    "superpole_race",
    "feature_race",
    "main_race",
    "heat_race",
}


def normalize_session_type(session_type: str | None, name: str | None) -> str:
    raw_type = (session_type or "").strip().lower()
    raw_name = (name or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw_type).strip("_")
    name_key = re.sub(r"[^a-z0-9]+", "_", raw_name).strip("_")

    if normalized in {"sprint_q", "sprint_qualifier", "sprint_qualification"}:
        return "sprint_qualifying"
    if "sprint" in name_key and any(
        token in name_key
        for token in {"qualifying", "qualification", "qualifier"}
    ):
        return "sprint_qualifying"
    if "superpole" in name_key and "race" in name_key:
        return "superpole_race"
    if "feature" in name_key and "race" in name_key:
        return "feature_race"
    if "main" in name_key and "race" in name_key:
        return "main_race"
    if "heat" in name_key and "race" in name_key:
        return "heat_race"
    if "sprint" in name_key and "race" in name_key:
        return "sprint"
    if normalized == "sprint":
        return "sprint"
    if "race" in name_key or normalized == "race":
        return "race"
    return normalized or name_key or "session"


def classify_session(
    session_type: str | None,
    name: str | None,
) -> tuple[str, str, bool]:
    normalized = normalize_session_type(session_type, name)
    if normalized in RACE_TYPES:
        return normalized, "race", True
    return normalized, "non_race", False
