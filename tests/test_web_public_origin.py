from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_preproduction_web_build_uses_same_origin_api():
    override = (ROOT / "docker-compose.preprod.yml").read_text(encoding="utf-8")
    dockerfile = (ROOT / "apps" / "web" / "Dockerfile").read_text(encoding="utf-8")
    sources = "\n".join(
        path.read_text(encoding="utf-8")
        for pattern in ("*.ts", "*.tsx")
        for path in (ROOT / "apps" / "web" / "src").rglob(pattern)
    )

    assert 'VITE_API_URL: ""' in override
    assert "ADMIN_WEB_ORIGIN: https://preprod.motorsports-events.fr" in override
    assert "CORS_ALLOWED_ORIGINS: https://preprod.motorsports-events.fr" in override
    assert "ARG VITE_API_URL=" in dockerfile
    assert "VITE_API_URL must be empty or HTTP(S)" in dockerfile
    assert "connect-src 'self' __API_ORIGIN__" in (
        ROOT / "apps" / "web" / "nginx.conf"
    ).read_text(encoding="utf-8")
    assert "http://127.0.0.1" not in sources
    assert "import.meta.env.DEV ? 'http://localhost:3001' : ''" in sources


def test_local_development_keeps_explicit_api_origin():
    app = (ROOT / "apps" / "web" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "import.meta.env.DEV ? 'http://localhost:3001' : ''" in app
