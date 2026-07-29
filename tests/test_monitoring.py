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
    assert "rule_files:" in prometheus
    assert "/etc/prometheus/alert-rules.yml" in prometheus
    assert "./monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro" in compose
    assert "GF_USERS_ALLOW_SIGN_UP" in compose
    rules = (ROOT / "monitoring/alert-rules.yml").read_text()
    assert "MotorsportsApiUnavailable" in rules
    assert 'up{job="motorsports-events-api"} == 0' in rules
    assert "MotorsportsApiHigh5xxRate" in rules
    assert "MotorsportsApiRepeatedRestarts" in rules
    assert "ADMIN_API_KEY" not in rules
    assert "PUBLIC_API_KEY" not in rules
    dashboard = json.loads(
        (ROOT / "monitoring/grafana/dashboards/api-overview.json").read_text()
    )
    assert dashboard["uid"] == "motorsports-events-api"
    expressions = json.dumps(dashboard)
    assert "motorsports_api_up" in expressions
    assert "motorsports_http_requests_total" in expressions
    assert "ALERTS" in expressions


def test_all_grafana_provisioning_directories_are_packaged():
    provisioning = ROOT / "monitoring/grafana/provisioning"

    for directory in ("alerting", "dashboards", "datasources", "plugins"):
        assert (provisioning / directory).is_dir()

    assert (
        "./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro"
        in (ROOT / "docker-compose.monitoring.yml").read_text()
    )
