#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--attempts", type=int, default=30)
    parser.add_argument("--delay", type=int, default=4)
    args = parser.parse_args()

    url = args.url.rstrip("/") + "/api/v1/health"

    for attempt in range(1, args.attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if payload.get("status") == "ok":
                    print(f"API opérationnelle : {url}")
                    return
        except (OSError, ValueError, urllib.error.URLError):
            pass

        print(
            f"Attente de l’API ({attempt}/{args.attempts})…"
        )
        time.sleep(args.delay)

    print("L’API ne répond pas correctement.", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
