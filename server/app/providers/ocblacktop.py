from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from .base import Provider, NormalizedEvent, NormalizedSession
from ..config import get_settings


class OcBlackTopProvider(Provider):
    name = "ocblacktop"

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._transport = transport

    async def fetch(self, season: int) -> list[NormalizedEvent]:
        settings = get_settings()

        if not settings.ocblacktop_enabled or not settings.ocblacktop_api_key:
            return []

        headers = {
            "Accept": "application/json",
            "x-api-key": settings.ocblacktop_api_key,
            "User-Agent": "Motorsports-Events-Server/2.7.0-alpha.5",
        }

        results: list[NormalizedEvent] = []

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(25.0, connect=8.0),
            follow_redirects=False,
            transport=self._transport,
        ) as client:
            for sport in settings.ocblacktop_sport_list:
                if sport == "wrc":
                    rows = await self._fetch_wrc(
                        client=client,
                        headers=headers,
                        base_url=settings.ocblacktop_base_url,
                        season=season,
                    )
                else:
                    rows = await self._fetch_paginated(
                        client=client,
                        headers=headers,
                        base_url=settings.ocblacktop_base_url,
                        sport=sport,
                        season=season,
                    )

                for row in rows:
                    event = self._normalize_event(row, sport)
                    if event is not None:
                        results.append(event)

        return results

    async def _fetch_paginated(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        base_url: str,
        sport: str,
        season: int,
    ) -> list[dict]:
        page = 1
        limit = 100
        rows: list[dict] = []

        while True:
            payload = await self._request(
                client,
                f"{base_url.rstrip('/')}/{sport}/events",
                headers,
                {
                    "page": page,
                    "limit": limit,
                    "year": season,
                },
                require_data=True,
            )

            page_rows = payload.get("data") or []
            rows.extend(item for item in page_rows if isinstance(item, dict))

            if len(page_rows) < limit:
                break

            pagination = payload.get("pagination") or payload.get("meta") or {}
            total_pages = pagination.get("totalPages") or pagination.get("total_pages")

            if total_pages is not None and page >= int(total_pages):
                break

            page += 1

            if page > 100:
                raise RuntimeError(
                    f"Pagination OCBlackTop excessive pour {sport}/{season}."
                )

        return rows

    async def _fetch_wrc(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        base_url: str,
        season: int,
    ) -> list[dict]:
        payload = await self._request(
            client,
            f"{base_url.rstrip('/')}/wrc/seasons/{season}",
            headers,
            {},
            require_data=False,
        )

        if isinstance(payload.get("rallies"), list):
            return payload["rallies"]

        data = payload.get("data")
        if isinstance(data, dict) and isinstance(data.get("rallies"), list):
            return data["rallies"]

        if isinstance(data, list):
            return data

        return []

    async def _request(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: dict[str, str],
        params: dict,
        require_data: bool,
    ) -> dict:
        response = await client.get(url, headers=headers, params=params)

        if response.status_code == 429:
            retry_after = int(response.headers.get("retry-after", "60") or "60")
            await asyncio.sleep(min(max(retry_after, 1), 300))
            response = await client.get(url, headers=headers, params=params)

        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError(
                f"Réponse JSON OCBlackTop invalide (HTTP {response.status_code}) "
                f"[{response.url}]"
            ) from exc

        if response.status_code < 200 or response.status_code >= 300:
            message = payload.get("message", "Erreur API") if isinstance(payload, dict) else "Erreur API"
            raise RuntimeError(
                f"HTTP {response.status_code} : {message} [{response.url}]"
            )

        if not isinstance(payload, dict):
            raise RuntimeError(f"Réponse OCBlackTop inattendue [{response.url}]")

        if require_data and not isinstance(payload.get("data"), list):
            raise RuntimeError(
                f"La réponse OCBlackTop ne contient pas de tableau data "
                f"[{response.url}]"
            )

        return payload

    def _normalize_event(self, row: dict, fallback_sport: str) -> NormalizedEvent | None:
        location = row.get("location") or {}
        country = location.get("country") or {}
        schedule = row.get("schedule") or row.get("sessions") or []

        sessions: list[NormalizedSession] = []

        for item in schedule:
            if not isinstance(item, dict):
                continue

            start = self.parse_dt(
                item.get("startTime")
                or item.get("start")
                or item.get("dateStart")
            )
            end = self.parse_dt(
                item.get("endTime")
                or item.get("end")
                or item.get("dateEnd")
            )

            if start is None:
                continue

            if end is None:
                end = start

            source_session_id = str(
                item.get("id")
                or f"{row.get('id', '')}:{item.get('type', '')}:{start.isoformat()}"
            )

            sessions.append(
                NormalizedSession(
                    source_session_id=source_session_id,
                    name=str(item.get("name") or item.get("type") or "Session"),
                    session_type=str(item.get("type") or "session"),
                    start_at=start,
                    end_at=end,
                    status=str(
                        item.get("status")
                        or row.get("status")
                        or "scheduled"
                    ),
                )
            )

        source_event_id = str(
            row.get("id")
            or row.get("eventId")
            or row.get("rallyId")
            or ""
        )

        if not source_event_id:
            return None

        sport_id = str(row.get("sportId") or fallback_sport)

        return NormalizedEvent(
            source=self.name,
            source_event_id=source_event_id,
            sport_id=sport_id,
            name=str(row.get("name") or row.get("eventName") or "Événement"),
            round=self.to_int(row.get("round")),
            status=str(row.get("status") or "scheduled"),
            venue=location.get("name") or row.get("venue"),
            city=location.get("city") or row.get("city"),
            country=country.get("name") or row.get("country"),
            country_code=(
                country.get("twoCode")
                or country.get("threeCode")
                or row.get("countryCode")
            ),
            sessions=sessions,
            raw_data=row,
        )

    @staticmethod
    def parse_dt(value):
        if not value:
            return None

        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None

    @staticmethod
    def to_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
