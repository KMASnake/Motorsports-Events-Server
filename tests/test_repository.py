from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_server_repository_does_not_contain_clients():
    assert not (ROOT / "clients").exists()
    assert not (ROOT / "android").exists()
    assert not (ROOT / "mybb-plugin").exists()


def test_required_server_files_exist():
    assert (ROOT / "docker-compose.yml").is_file()
    assert (ROOT / "install.sh").is_file()
    assert (ROOT / "server" / "Dockerfile").is_file()
    assert (ROOT / "server" / "alembic.ini").is_file()
    assert (
        ROOT
        / "server"
        / "alembic"
        / "versions"
        / "0001_initial_schema.py"
    ).is_file()
    assert (ROOT / "server" / "app" / "main.py").is_file()


def test_version_is_defined():
    assert (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def test_events_query_does_not_apply_distinct_to_json_rows():
    source = (
        ROOT / "server" / "app" / "main.py"
    ).read_text(encoding="utf-8")

    assert ".distinct().all()" not in source
    assert "matching_sessions.c.first_start" in source
