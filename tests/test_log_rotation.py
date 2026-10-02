from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent


def test_all_production_services_use_bounded_log_rotation():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "x-default-logging: &default-logging" in compose
    assert 'driver: json-file' in compose
    assert 'max-size: "10m"' in compose
    assert 'max-file: "5"' in compose
    assert 'compress: "true"' in compose
    services = {
        match.group("name"): match.group("body")
        for match in re.finditer(
            r"^  (?P<name>[a-z][a-z0-9_-]*):\n(?P<body>(?: {4}.*\n|\n)*)",
            compose,
            re.MULTILINE,
        )
    }

    for service in ("postgres", "api", "worker", "web"):
        assert "logging: *default-logging" in services[service]

    # The migration container is one-shot and does not need rotated log files.
    assert "logging: *default-logging" not in services["migrate"]
