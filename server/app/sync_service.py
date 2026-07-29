"""Compatibilité avec l'ancien point d'entrée de synchronisation."""

from .application.synchronization import SynchronizationInProgress, synchronize

__all__ = ["SynchronizationInProgress", "synchronize"]
