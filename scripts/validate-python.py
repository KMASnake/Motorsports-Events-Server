#!/usr/bin/env python3
from __future__ import annotations

import ast
from pathlib import Path

root = Path(__file__).resolve().parent.parent
errors: list[str] = []

for path in root.rglob("*.py"):
    if "__pycache__" in path.parts:
        continue

    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except SyntaxError as exc:
        errors.append(f"{path.relative_to(root)} : {exc}")

if errors:
    raise SystemExit("\n".join(errors))

print("Syntaxe Python : OK")
