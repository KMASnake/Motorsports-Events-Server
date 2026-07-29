"""Façade de compatibilité pour l’ancien point d’entrée des migrations."""

from .schema_migrations import upgrade_database


def apply_runtime_migrations() -> None:
    upgrade_database()
