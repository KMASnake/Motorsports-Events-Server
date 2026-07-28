"""Compatibilité avec l'ancien emplacement de l'adaptateur SQLAlchemy."""

from .infrastructure.persistence.database import Base, SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
