"""Compatibilité avec l'ancien emplacement du classificateur métier."""

from .domain.session_classification import (
    RACE_TYPES,
    classify_session,
    normalize_session_type,
)

__all__ = ["RACE_TYPES", "classify_session", "normalize_session_type"]
