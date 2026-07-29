from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_observability_endpoints_are_public_and_bounded():
    main = (ROOT / "server/app/main.py").read_text(encoding="utf-8")
    metrics = (
        ROOT / "server/app/observability.py"
    ).read_text(encoding="utf-8")

    assert '@app.get("/live"' in main
    assert '@app.get("/ready"' in main
    assert '@app.get("/metrics"' in main
    assert 'text("SELECT 1")' in main
    public_section = main[
        main.index('@app.get("/live"'):main.index('"/api/v1/sports"')
    ]
    assert "require_public_key" not in public_section
    assert "motorsports_http_requests_total" in metrics
    assert "request.url.path" not in metrics
    assert "api_key" not in metrics
