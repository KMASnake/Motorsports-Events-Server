from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent

def test_monitoring_is_private_and_scrapes_api():
    compose = (ROOT / "docker-compose.monitoring.yml").read_text()
    prometheus = (ROOT / "monitoring/prometheus.yml").read_text()
    assert '"127.0.0.1:3000:3000"' in compose
    assert "9090:9090" not in compose
    assert 'targets: ["api:8000"]' in prometheus
    assert "metrics_path: /metrics" in prometheus
    assert "GF_USERS_ALLOW_SIGN_UP" in compose
    dashboard = json.loads(
        (ROOT / "monitoring/grafana/dashboards/api-overview.json").read_text()
    )
    assert dashboard["uid"] == "motorsports-events-api"
    expressions = json.dumps(dashboard)
    assert "motorsports_api_up" in expressions
    assert "motorsports_http_requests_total" in expressions
