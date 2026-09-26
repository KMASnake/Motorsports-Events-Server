from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_preprod_prometheus_is_permanent_private_and_persistent():
    compose = (ROOT / "docker-compose.preprod.yml").read_text(encoding="utf-8")
    prometheus = (ROOT / "monitoring" / "prometheus.yml").read_text(encoding="utf-8")
    rules = (ROOT / "monitoring" / "alert-rules.yml").read_text(encoding="utf-8")

    assert "  prometheus:" in compose
    assert "prom/prometheus:v3.13.1" in compose
    assert "--storage.tsdb.retention.time=15d" in compose
    assert "preprod_prometheus_data:/prometheus" in compose
    assert "mse_preprod_prometheus_data" in compose
    prometheus_block = compose.split("  prometheus:", 1)[1].split("  migrate:", 1)[0]
    assert "ports:" not in prometheus_block
    assert "restart: unless-stopped" in prometheus_block
    assert 'max-size: "10m"' in prometheus_block
    assert 'targets: ["api:3001"]' in prometheus
    for alert in (
        "MotorsportsApiUnavailable",
        "MotorsportsApiHigh5xxRate",
        "MotorsportsApiRepeatedRestarts",
    ):
        assert alert in rules


def test_caddy_preprod_connectivity_and_hardening_are_declarative():
    preprod = (ROOT / "docker-compose.preprod.yml").read_text(encoding="utf-8")
    caddy_override = (
        ROOT / "infra" / "caddy" / "docker-compose.preprod-network.yml"
    ).read_text(encoding="utf-8")
    integration = (
        ROOT / "infra" / "caddy" / "Caddyfile.integration"
    ).read_text(encoding="utf-8")
    caddy = (ROOT / "infra" / "caddy" / "Caddyfile.preprod").read_text(
        encoding="utf-8"
    )

    assert "mse-preprod-proxy" in preprod
    assert "aliases: [mse-preprod-api]" in preprod
    assert "aliases: [mse-preprod-web]" in preprod
    assert "external: true" in caddy_override
    assert "mse-preprod-proxy" in caddy_override
    assert "docker network connect" not in caddy_override
    assert "import /etc/caddy/Caddyfile.production" in integration
    assert "import /etc/caddy/Caddyfile.preprod" in integration
    assert "preprod.motorsports-events.fr" in caddy
    assert "    route {" in caddy
    assert "@api path /health /health/* /api/*" in caddy
    assert "reverse_proxy @api mse-preprod-api:3001" in caddy
    assert "reverse_proxy mse-preprod-web:3000" in caddy
    assert caddy.index("@metrics path /metrics") < caddy.index("@sensitive path")
    assert caddy.index("respond @metrics 404") < caddy.index(
        "reverse_proxy mse-preprod-web:3000"
    )
    assert caddy.index("respond @sensitive 404") < caddy.index(
        "reverse_proxy @api mse-preprod-api:3001"
    )
    assert caddy.index("reverse_proxy @api mse-preprod-api:3001") < caddy.index(
        "reverse_proxy mse-preprod-web:3000"
    )
    for path in (
        "/.env",
        "/.env.*",
        "/.git/*",
        "/.svn/*",
        "/.hg/*",
        "/.DS_Store",
        "/.vscode/*",
        "/.idea/*",
        "/server-status",
        "/actuator/*",
        "/trace.axd",
        "/info.php",
        "/phpinfo.php",
        "/telescope/*",
        "/v2/_catalog",
        "/wp-admin*",
        "/wp-login.php",
        "/xmlrpc.php",
    ):
        assert path in caddy


def test_production_proxy_contract_and_preprod_safety_remain_intact():
    production = (ROOT / "Caddyfile").read_text(encoding="utf-8")
    preprod = (ROOT / "docker-compose.preprod.yml").read_text(encoding="utf-8")

    assert "{$API_DOMAIN}" in production
    assert "reverse_proxy api:8000" in production
    assert "preprod.motorsports-events.fr" not in production
    assert 'PREVIEW_API_ENABLED: "false"' in preprod
    assert "PROVIDER_MASTER_KEYS" not in preprod
    protocol = (
        ROOT / "docs" / "handoff" / "LOT-5.7-P-F-STAGING-PERSISTENCE.md"
    ).read_text(encoding="utf-8")
    assert "select count(*) from provider_instances where enabled or state='active'" in protocol
    assert "| grep -qx 0" in protocol
