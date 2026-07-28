from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "Motorsports Events"
    database_url: str
    admin_api_key: str
    public_api_key: str = ""

    ocblacktop_enabled: bool = True
    ocblacktop_base_url: str = "https://api.ocblacktop.com/v1"
    ocblacktop_api_key: str = ""
    ocblacktop_sports: str = ""

    thesportsdb_enabled: bool = True
    thesportsdb_base_url: str = "https://www.thesportsdb.com/api/v1/json"
    thesportsdb_api_key: str = "123"
    thesportsdb_leagues: str = "wsbk:4454,wssp:5873"

    sync_interval_minutes: int = 60
    sync_season: int = 2026
    sync_import_mode: str = "all"
    timezone: str = "Europe/Paris"
    log_level: str = "INFO"

    @property
    def ocblacktop_sport_list(self) -> list[str]:
        return [x.strip() for x in self.ocblacktop_sports.split(",") if x.strip()]

    @property
    def thesportsdb_league_map(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for item in self.thesportsdb_leagues.split(","):
            if ":" not in item:
                continue
            slug, league_id = item.split(":", 1)
            result[slug.strip()] = league_id.strip()
        return result


@lru_cache
def get_settings() -> Settings:
    return Settings()
