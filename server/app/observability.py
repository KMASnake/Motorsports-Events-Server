from collections import Counter
from threading import Lock
from time import monotonic


_started_at = monotonic()
_requests: Counter[tuple[str, str, int]] = Counter()
_lock = Lock()


def record_request(method: str, route: str, status_code: int) -> None:
    with _lock:
        _requests[(method, route, status_code)] += 1


def prometheus_metrics() -> str:
    lines = [
        "# HELP motorsports_api_up Whether the API process is running.",
        "# TYPE motorsports_api_up gauge",
        "motorsports_api_up 1",
        "# HELP motorsports_api_uptime_seconds API process uptime.",
        "# TYPE motorsports_api_uptime_seconds gauge",
        f"motorsports_api_uptime_seconds {monotonic() - _started_at:.3f}",
        "# HELP motorsports_http_requests_total Completed HTTP requests.",
        "# TYPE motorsports_http_requests_total counter",
    ]
    with _lock:
        rows = sorted(_requests.items())
    for (method, route, status), count in rows:
        safe_route = route.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(
            "motorsports_http_requests_total"
            f'{{method="{method}",route="{safe_route}",status="{status}"}} {count}'
        )
    return "\n".join(lines) + "\n"
