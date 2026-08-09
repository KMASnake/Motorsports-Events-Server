from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_all_production_services_use_bounded_log_rotation():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    assert "x-default-logging: &default-logging" in compose
    assert 'driver: json-file' in compose
    assert 'max-size: "10m"' in compose
    assert 'max-file: "5"' in compose
    assert 'compress: "true"' in compose
    # PostgreSQL, API and Web are persistent services. The migration container
    # is one-shot and does not need its own rotated log files.
    assert compose.count("logging: *default-logging") == 3
