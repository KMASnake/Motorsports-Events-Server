from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent


def test_compose_defaults_match_release_files():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    root_version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    server_version = (
        ROOT / "server" / "VERSION"
    ).read_text(encoding="utf-8").strip()
    server_build = (ROOT / "server" / "BUILD").read_text(encoding="utf-8").strip()

    assert root_version == server_version
    assert re.findall(r"APP_VERSION: \$\{APP_VERSION:-(.+)\}", compose) == [
        root_version,
        root_version,
    ]
    assert re.findall(r"APP_BUILD: \$\{APP_BUILD:-(.+)\}", compose) == [
        server_build,
        server_build,
    ]
