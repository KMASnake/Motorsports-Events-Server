from datetime import datetime, timedelta, timezone
import httpx
from .base import Provider, NormalizedEvent, NormalizedSession
from ..config import get_settings


class TheSportsDbProvider(Provider):
    name = "thesportsdb"

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._transport = transport

    async def fetch(self, season: int) -> list[NormalizedEvent]:
        settings = get_settings()
        if not settings.thesportsdb_enabled:
            return []

        result = []
        base = settings.thesportsdb_base_url.rstrip("/")
        key = settings.thesportsdb_api_key

        async with httpx.AsyncClient(
            timeout=30,
            transport=self._transport,
        ) as client:
            for sport, league_id in settings.thesportsdb_league_map.items():
                response = await client.get(
                    f"{base}/{key}/eventsseason.php",
                    params={"id": league_id, "s": season},
                )
                response.raise_for_status()

                for row in response.json().get("events") or []:
                    name = str(row.get("strEvent") or row.get("strFilename") or "")
                    start = self.parse_dt(row)
                    if not name or not start:
                        continue

                    source_id = str(
                        row.get("idEvent") or f"{sport}-{name}-{start.isoformat()}"
                    )
                    status = self.status(row)

                    result.append(NormalizedEvent(
                        source=self.name,
                        source_event_id=f"{sport}:{source_id}",
                        sport_id=sport,
                        name=name,
                        round=self.to_int(row.get("intRound")),
                        status=status,
                        venue=row.get("strVenue"),
                        city=row.get("strCity"),
                        country=row.get("strCountry"),
                        sessions=[NormalizedSession(
                            source_session_id=f"{sport}:{source_id}",
                            name="Course",
                            session_type="race",
                            start_at=start,
                            end_at=start + timedelta(hours=2),
                            status=status,
                        )],
                        raw_data=row,
                    ))

        return result

    @staticmethod
    def parse_dt(row):
        timestamp = row.get("strTimestamp")
        if timestamp:
            try:
                return datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
            except ValueError:
                pass

        date = row.get("dateEvent")
        time = row.get("strTime") or "00:00:00"
        if not date:
            return None
        try:
            return datetime.fromisoformat(f"{date}T{time}").replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    @staticmethod
    def status(row):
        if str(row.get("strPostponed") or "").lower() in {"yes", "1", "true"}:
            return "postponed"
        return {
            "finished": "completed",
            "completed": "completed",
            "cancelled": "cancelled",
            "canceled": "cancelled",
            "live": "live",
            "postponed": "postponed",
        }.get(str(row.get("strStatus") or "").lower(), "scheduled")

    @staticmethod
    def to_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
