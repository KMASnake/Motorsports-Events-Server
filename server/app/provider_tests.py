from __future__ import annotations
import time
import httpx
from .config import get_settings

async def test_ocblacktop() -> dict:
    s = get_settings()
    if not s.ocblacktop_enabled:
        return {"provider":"OCBlackTop","ok":False,"message":"Provider désactivé.","latency_ms":None}
    if not s.ocblacktop_api_key:
        return {"provider":"OCBlackTop","ok":False,"message":"Clé API absente.","latency_ms":None}
    sport = next((x for x in s.ocblacktop_sport_list if x != "wrc"), "formula-1")
    url = f"{s.ocblacktop_base_url.rstrip('/')}/{sport}/events"
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers={"x-api-key":s.ocblacktop_api_key},
                                 params={"page":1,"limit":1,"year":s.sync_season})
        latency = round((time.perf_counter()-started)*1000)
        ok = 200 <= r.status_code < 300
        return {"provider":"OCBlackTop","ok":ok,
                "message":"Connexion réussie." if ok else f"HTTP {r.status_code}",
                "latency_ms":latency}
    except Exception as exc:
        return {"provider":"OCBlackTop","ok":False,"message":str(exc),"latency_ms":None}

async def test_thesportsdb() -> dict:
    s = get_settings()
    if not s.thesportsdb_enabled:
        return {"provider":"TheSportsDB","ok":False,"message":"Provider désactivé.","latency_ms":None}
    league = next(iter(s.thesportsdb_league_map.values()), "4454")
    url = f"{s.thesportsdb_base_url.rstrip('/')}/{s.thesportsdb_api_key}/eventsseason.php"
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params={"id":league,"s":s.sync_season})
        latency = round((time.perf_counter()-started)*1000)
        ok = 200 <= r.status_code < 300
        return {"provider":"TheSportsDB","ok":ok,
                "message":"Connexion réussie." if ok else f"HTTP {r.status_code}",
                "latency_ms":latency}
    except Exception as exc:
        return {"provider":"TheSportsDB","ok":False,"message":str(exc),"latency_ms":None}
