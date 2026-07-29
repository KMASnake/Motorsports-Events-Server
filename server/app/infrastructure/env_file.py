from __future__ import annotations

import os
import re
from pathlib import Path


KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")


def decode_env_value(value: str) -> str:
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
    return value


def encode_env_value(value: object) -> str:
    text = str(value)
    must_quote = (
        text == ""
        or any(char.isspace() for char in text)
        or any(char in text for char in '#"\\$`')
    )
    if not must_quote:
        return text

    escaped = (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )
    return f'"{escaped}"'


def parse_env_text(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if KEY_PATTERN.fullmatch(key):
            values[key] = decode_env_value(value)
    return values


def render_env_updates(text: str, updates: dict[str, str]) -> str:
    invalid = [key for key in updates if not KEY_PATTERN.fullmatch(key)]
    if invalid:
        raise ValueError("Nom de variable de configuration invalide.")

    remaining = dict(updates)
    rendered: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and "=" in raw_line:
            key = raw_line.split("=", 1)[0].strip()
            if key in remaining:
                rendered.append(f"{key}={encode_env_value(remaining.pop(key))}")
                continue
        rendered.append(raw_line)

    if remaining:
        if rendered and rendered[-1] != "":
            rendered.append("")
        for key, value in remaining.items():
            rendered.append(f"{key}={encode_env_value(value)}")

    return "\n".join(rendered).rstrip() + "\n"


def read_env_file(path: Path) -> tuple[str, dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    return text, parse_env_text(text)


def write_env_updates(path: Path, updates: dict[str, str]) -> None:
    original = path.read_text(encoding="utf-8")
    rendered = render_env_updates(original, updates)

    try:
        with path.open("r+", encoding="utf-8") as handle:
            handle.seek(0)
            handle.write(rendered)
            handle.truncate()
            handle.flush()
            os.fsync(handle.fileno())
        path.chmod(0o600)
    except Exception:
        with path.open("w", encoding="utf-8") as handle:
            handle.write(original)
            handle.flush()
            os.fsync(handle.fileno())
        path.chmod(0o600)
        raise
