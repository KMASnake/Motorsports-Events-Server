from abc import ABC, abstractmethod

from ..domain.events import NormalizedEvent, NormalizedSession

# Compatibilité : les providers et les extensions externes peuvent continuer
# d'importer les modèles depuis app.providers.base pendant la transition.
__all__ = ["NormalizedEvent", "NormalizedSession", "Provider"]


class Provider(ABC):
    name: str

    @abstractmethod
    async def fetch(self, season: int) -> list[NormalizedEvent]:
        raise NotImplementedError
