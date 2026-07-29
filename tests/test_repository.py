from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_server_repository_does_not_contain_clients():
    assert not (ROOT / "clients").exists()
    assert not (ROOT / "android").exists()
    assert not (ROOT / "mybb-plugin").exists()


def test_required_server_files_exist():
    assert (ROOT / "docker-compose.yml").is_file()
    assert (ROOT / "docker-compose.test.yml").is_file()
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
    assert (ROOT / "tests" / "Dockerfile").is_file()
    assert (
        ROOT / "tests" / "fixtures" / "indycar_events.json"
    ).is_file()


def test_version_is_defined():
    assert (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def test_events_query_does_not_apply_distinct_to_json_rows():
    source = (
        ROOT / "server" / "app" / "main.py"
    ).read_text(encoding="utf-8")

    assert ".distinct().all()" not in source
    assert "matching_sessions.c.first_start" in source


def test_installation_check_uses_running_api_network():
    source = (
        ROOT / "scripts" / "verify-installation.sh"
    ).read_text(encoding="utf-8")

    assert "docker compose exec -T api" in source
    assert "docker compose run --rm --no-deps migrate" not in source


def test_admin_routes_are_isolated_from_main():
    main_source = (
        ROOT / "server" / "app" / "main.py"
    ).read_text(encoding="utf-8")
    admin_source = (
        ROOT / "server" / "app" / "admin" / "core.py"
    ).read_text(encoding="utf-8")
    router_source = (
        ROOT / "server" / "app" / "admin" / "__init__.py"
    ).read_text(encoding="utf-8")

    assert '@app.get("/admin' not in main_source
    assert '@app.post("/admin' not in main_source
    assert '"/api/v1/admin/' not in main_source
    assert "router.include_router(core_router)" in router_source
    assert "router.include_router(extension_router)" in router_source

    expected_routes = {
        "/admin/login",
        "/admin",
        "/admin/sync",
        "/admin/overrides/{override_id}/delete",
        "/api/v1/admin/sync",
        "/api/v1/admin/overrides",
        "/api/v1/admin/overrides/{override_id}",
    }
    for route in expected_routes:
        assert route in admin_source
