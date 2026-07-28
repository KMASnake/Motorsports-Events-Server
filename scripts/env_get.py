#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            quote = value[0]
            value = value[1:-1]
            if quote == '"':
                value = (
                    value.replace("\\n", "\n")
                    .replace("\\r", "\r")
                    .replace('\\"', '"')
                    .replace("\\\\", "\\")
                )

        values[key] = value

    return values


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("key")
    parser.add_argument("--env", default=".env")
    parser.add_argument("--required", action="store_true")
    args = parser.parse_args()

    values = parse_env(Path(args.env))
    value = values.get(args.key, "")

    if args.required and value == "":
        raise SystemExit(f"Variable requise absente : {args.key}")

    print(value, end="")


if __name__ == "__main__":
    main()
