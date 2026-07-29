import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

try:
    import httpx

    from app.providers.ocblacktop import OcBlackTopProvider
    from app.providers.thesportsdb import TheSportsDbProvider

    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False


def ocblacktop_settings(
    *,
    enabled=True,
    api_key="secret",
    sports=None,
):
    return SimpleNamespace(
        ocblacktop_enabled=enabled,
        ocblacktop_api_key=api_key,
        ocblacktop_sport_list=sports or ["formula-1"],
        ocblacktop_base_url="https://ocblacktop.test/v1",
    )


def thesportsdb_settings(*, enabled=True):
    return SimpleNamespace(
        thesportsdb_enabled=enabled,
        thesportsdb_base_url="https://thesportsdb.test/api/v1/json",
        thesportsdb_api_key="123",
        thesportsdb_league_map={"wsbk": "4454"},
    )


@unittest.skipUnless(
    DEPENDENCIES_AVAILABLE,
    "httpx et les dépendances applicatives ne sont pas installés.",
)
class OcBlackTopProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_or_unconfigured_provider_returns_no_event(self):
        provider = OcBlackTopProvider(
            httpx.MockTransport(
                lambda _request: self.fail("Aucune requête attendue")
            )
        )

        for settings in (
            ocblacktop_settings(enabled=False),
            ocblacktop_settings(api_key=""),
        ):
            with self.subTest(settings=settings):
                with patch(
                    "app.providers.ocblacktop.get_settings",
                    return_value=settings,
                ):
                    self.assertEqual([], await provider.fetch(2026))

    async def test_fetch_paginates_and_normalizes_events(self):
        pages = []

        def handler(request):
            self.assertEqual("secret", request.headers["x-api-key"])
            page = int(request.url.params["page"])
            pages.append(page)
            count = 100 if page == 1 else 1
            rows = [
                {
                    "id": f"event-{page}-{index}",
                    "name": "Grand Prix",
                    "round": "4",
                    "location": {
                        "name": "Circuit",
                        "city": "Paris",
                        "country": {
                            "name": "France",
                            "twoCode": "FR",
                        },
                    },
                    "schedule": [
                        {
                            "id": f"session-{page}-{index}",
                            "name": "Race",
                            "type": "race",
                            "startTime": "2026-06-01T12:00:00Z",
                            "endTime": "2026-06-01T14:00:00Z",
                        }
                    ],
                }
                for index in range(count)
            ]
            return httpx.Response(200, json={"data": rows})

        provider = OcBlackTopProvider(httpx.MockTransport(handler))
        with patch(
            "app.providers.ocblacktop.get_settings",
            return_value=ocblacktop_settings(),
        ):
            events = await provider.fetch(2026)

        self.assertEqual([1, 2], pages)
        self.assertEqual(101, len(events))
        event = events[0]
        self.assertEqual("formula-1", event.sport_id)
        self.assertEqual(4, event.round)
        self.assertEqual("Circuit", event.venue)
        self.assertEqual("FR", event.country_code)
        self.assertEqual("race", event.sessions[0].session_type)
        self.assertEqual(timezone.utc, event.sessions[0].start_at.tzinfo)

    async def test_wrc_nested_payload_is_supported(self):
        def handler(request):
            self.assertTrue(request.url.path.endswith("/wrc/seasons/2026"))
            return httpx.Response(
                200,
                json={
                    "data": {
                        "rallies": [
                            {
                                "rallyId": "rally-1",
                                "eventName": "Rally Test",
                                "sessions": [],
                            }
                        ]
                    }
                },
            )

        provider = OcBlackTopProvider(httpx.MockTransport(handler))
        with patch(
            "app.providers.ocblacktop.get_settings",
            return_value=ocblacktop_settings(sports=["wrc"]),
        ):
            events = await provider.fetch(2026)

        self.assertEqual(1, len(events))
        self.assertEqual("rally-1", events[0].source_event_id)
        self.assertEqual("wrc", events[0].sport_id)

    async def test_rate_limit_is_retried_once(self):
        responses = iter(
            (
                httpx.Response(429, headers={"retry-after": "2"}, json={}),
                httpx.Response(200, json={"data": []}),
            )
        )

        def handler(_request):
            return next(responses)

        provider = OcBlackTopProvider()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as client:
            with patch(
                "app.providers.ocblacktop.asyncio.sleep",
                new=AsyncMock(),
            ) as sleep:
                payload = await provider._request(
                    client,
                    "https://ocblacktop.test/events",
                    {},
                    {},
                    require_data=True,
                )

        self.assertEqual({"data": []}, payload)
        sleep.assert_awaited_once_with(2)

    async def test_invalid_responses_are_rejected(self):
        cases = (
            (
                httpx.Response(500, json={"message": "Panne"}),
                "HTTP 500 : Panne",
            ),
            (
                httpx.Response(200, content=b"not-json"),
                "Réponse JSON OCBlackTop invalide",
            ),
            (
                httpx.Response(200, json={"data": {}}),
                "ne contient pas de tableau data",
            ),
        )

        for response, expected in cases:
            with self.subTest(expected=expected):
                provider = OcBlackTopProvider()
                async with httpx.AsyncClient(
                    transport=httpx.MockTransport(
                        lambda _request, value=response: value
                    )
                ) as client:
                    with self.assertRaisesRegex(RuntimeError, expected):
                        await provider._request(
                            client,
                            "https://ocblacktop.test/events",
                            {},
                            {},
                            require_data=True,
                        )

    def test_normalization_skips_invalid_sessions_and_events(self):
        provider = OcBlackTopProvider()
        self.assertIsNone(
            provider._normalize_event(
                {"name": "Sans identifiant"},
                "formula-1",
            )
        )

        event = provider._normalize_event(
            {
                "id": "event-1",
                "schedule": [
                    {"id": "invalid", "startTime": "not-a-date"},
                    {
                        "type": "practice",
                        "startTime": "2026-07-01T10:00:00Z",
                    },
                ],
            },
            "indycar",
        )

        self.assertIsNotNone(event)
        self.assertEqual(1, len(event.sessions))
        self.assertEqual(
            event.sessions[0].start_at,
            event.sessions[0].end_at,
        )
        self.assertIsNone(provider.to_int("invalid"))


@unittest.skipUnless(
    DEPENDENCIES_AVAILABLE,
    "httpx et les dépendances applicatives ne sont pas installés.",
)
class TheSportsDbProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_provider_returns_no_event(self):
        provider = TheSportsDbProvider(
            httpx.MockTransport(
                lambda _request: self.fail("Aucune requête attendue")
            )
        )
        with patch(
            "app.providers.thesportsdb.get_settings",
            return_value=thesportsdb_settings(enabled=False),
        ):
            self.assertEqual([], await provider.fetch(2026))

    async def test_fetch_normalizes_valid_rows_and_skips_invalid_rows(self):
        def handler(request):
            self.assertTrue(request.url.path.endswith("/123/eventsseason.php"))
            self.assertEqual("4454", request.url.params["id"])
            self.assertEqual("2026", request.url.params["s"])
            return httpx.Response(
                200,
                json={
                    "events": [
                        {
                            "idEvent": "42",
                            "strEvent": "WorldSBK Test",
                            "strTimestamp": "2026-05-01T12:30:00Z",
                            "intRound": "3",
                            "strStatus": "Finished",
                            "strVenue": "Circuit",
                        },
                        {
                            "idEvent": "invalid",
                            "strEvent": "",
                            "dateEvent": "invalid",
                        },
                    ]
                },
            )

        provider = TheSportsDbProvider(httpx.MockTransport(handler))
        with patch(
            "app.providers.thesportsdb.get_settings",
            return_value=thesportsdb_settings(),
        ):
            events = await provider.fetch(2026)

        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual("wsbk:42", event.source_event_id)
        self.assertEqual("completed", event.status)
        self.assertEqual(3, event.round)
        self.assertEqual("race", event.sessions[0].session_type)
        self.assertEqual(
            event.sessions[0].start_at.replace(hour=14, minute=30),
            event.sessions[0].end_at,
        )

    def test_date_fallback_statuses_and_rounds(self):
        parsed = TheSportsDbProvider.parse_dt(
            {
                "strTimestamp": "invalid",
                "dateEvent": "2026-08-02",
                "strTime": "15:45:00",
            }
        )
        self.assertEqual(
            datetime(2026, 8, 2, 15, 45, tzinfo=timezone.utc),
            parsed,
        )
        self.assertIsNone(TheSportsDbProvider.parse_dt({}))
        self.assertEqual(
            "postponed",
            TheSportsDbProvider.status({"strPostponed": "yes"}),
        )
        self.assertEqual(
            "cancelled",
            TheSportsDbProvider.status({"strStatus": "Canceled"}),
        )
        self.assertEqual(
            "scheduled",
            TheSportsDbProvider.status({"strStatus": "Unknown"}),
        )
        self.assertIsNone(TheSportsDbProvider.to_int("not-a-round"))


if __name__ == "__main__":
    unittest.main()
