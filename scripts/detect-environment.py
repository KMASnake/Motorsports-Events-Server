#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
from pathlib import Path


def detect_environment() -> dict[str, object]:
    evidence: list[str] = []

    synology_files = (
        Path("/etc/synoinfo.conf"),
        Path("/etc.defaults/synoinfo.conf"),
        Path("/etc.defaults/VERSION"),
    )

    if any(path.exists() for path in synology_files):
        evidence.append("fichier système Synology détecté")

    if shutil.which("synopkg"):
        evidence.append("commande synopkg disponible")

    if Path("/volume1").exists():
        evidence.append("volume /volume1 détecté")

    release_text = ""
    for path in (Path("/etc.defaults/VERSION"), Path("/etc/os-release")):
        if path.exists():
            try:
                release_text += path.read_text(
                    encoding="utf-8",
                    errors="ignore",
                ).lower()
            except OSError:
                pass

    if "synology" in release_text or "dsm" in release_text:
        evidence.append("DSM/Synology présent dans les informations système")

    environment = "synology" if evidence else "vps"

    return {
        "environment": environment,
        "confidence": "high" if len(evidence) >= 2 else (
            "medium" if evidence else "high"
        ),
        "evidence": evidence or [
            "aucun marqueur DSM détecté ; environnement Linux générique"
        ],
        "system": platform.system(),
        "machine": platform.machine(),
        "hostname": platform.node(),
        "docker": shutil.which("docker") is not None,
        "python": platform.python_version(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Détecte Synology DSM ou VPS Linux."
    )
    parser.add_argument(
        "--plain",
        action="store_true",
        help="Affiche uniquement synology ou vps.",
    )
    args = parser.parse_args()

    result = detect_environment()

    if args.plain:
        print(result["environment"])
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
