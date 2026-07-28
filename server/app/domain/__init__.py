"""Modèle métier indépendant de FastAPI, SQLAlchemy et des providers."""

from .events import NormalizedEvent, NormalizedSession
from .session_classification import classify_session, normalize_session_type
from .sports import SPORT_NAMES, sport_display_name

__all__ = [
    "NormalizedEvent",
    "NormalizedSession",
    "SPORT_NAMES",
    "classify_session",
    "normalize_session_type",
    "sport_display_name",
]
