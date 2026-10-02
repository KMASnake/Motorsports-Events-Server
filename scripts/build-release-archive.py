#!/usr/bin/env python3
"""Build a release ZIP exclusively from committed Git blobs."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path, PurePosixPath
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


PREFIX = PurePosixPath("motorsports-events-server")
SAFE_ENV_EXAMPLES = {".env.example", ".env.preprod.example"}
GENERATED_PATH = PurePosixPath("release-metadata.json")


def git(repository: Path, *arguments: str) -> bytes:
    try:
        return subprocess.run(
            ["git", "-C", str(repository), *arguments],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        detail = getattr(error, "stderr", b"").decode("utf-8", "replace").strip()
        raise SystemExit(f"Inventaire Git indisponible: {detail or error}") from error


def tracked_blobs(repository: Path, commit: str) -> list[tuple[str, str, str]]:
    entries: list[tuple[str, str, str]] = []
    raw = git(repository, "ls-tree", "-rz", "--full-tree", commit)
    for record in raw.split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        mode, object_type, object_id = metadata.decode("ascii").split(" ")
        path = raw_path.decode("utf-8", "surrogateescape")
        if object_type != "blob":
            raise SystemExit(f"Entrée Git non supportée dans la release: {path}")
        entries.append((path, mode, object_id))
    if not entries:
        raise SystemExit("L'inventaire Git de la release est vide.")
    return sorted(entries, key=lambda item: item[0].encode("utf-8", "surrogateescape"))


def validate_path(path: str) -> None:
    value = PurePosixPath(path)
    if value.is_absolute() or ".." in value.parts:
        raise SystemExit(f"Chemin Git non sûr refusé: {path}")
    if path == str(GENERATED_PATH):
        raise SystemExit(f"Le chemin généré est déjà suivi par Git: {path}")
    for part in value.parts:
        if part == ".env" or (part.startswith(".env.") and part not in SAFE_ENV_EXAMPLES):
            raise SystemExit(f"Fichier d'environnement sensible suivi par Git: {path}")


def archive_path(path: str) -> PurePosixPath:
    validate_path(path)
    destination = PREFIX / PurePosixPath(path)
    if destination.parts[: len(PREFIX.parts)] != PREFIX.parts or ".." in destination.parts:
        raise SystemExit(f"Destination d'archive hors racine refusée: {path}")
    return destination


def zip_info(name: PurePosixPath, timestamp: tuple[int, int, int, int, int, int], mode: int) -> ZipInfo:
    info = ZipInfo(str(name), timestamp)
    info.create_system = 3
    info.external_attr = (mode & 0xFFFF) << 16
    info.compress_type = ZIP_DEFLATED
    return info


def commit_timestamp(repository: Path, commit: str) -> tuple[int, int, int, int, int, int]:
    raw = git(repository, "show", "-s", "--format=%ct", commit).decode("ascii").strip()
    try:
        value = datetime.fromtimestamp(int(raw), timezone.utc)
    except (ValueError, OverflowError, OSError) as error:
        raise SystemExit("Timestamp du commit Git invalide.") from error
    if value.year < 1980:
        value = datetime(1980, 1, 1, tzinfo=timezone.utc)
    return value.year, value.month, value.day, value.hour, value.minute, value.second


def build(arguments: argparse.Namespace) -> None:
    repository = arguments.repository.resolve()
    commit = git(repository, "rev-parse", "--verify", f"{arguments.commit}^{{commit}}").decode("ascii").strip()
    if commit != arguments.git_sha:
        raise SystemExit("Le SHA des métadonnées ne correspond pas au commit empaqueté.")
    entries = tracked_blobs(repository, commit)
    destinations = {path: archive_path(path) for path, _, _ in entries}

    timestamp = commit_timestamp(repository, commit)
    output = arguments.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(f"{output.name}.partial")
    partial.unlink(missing_ok=True)
    metadata = json.dumps(
        {"version": arguments.version, "git_sha": commit, "build_time": arguments.build_time},
        indent=2,
    ).encode() + b"\n"

    try:
        with ZipFile(partial, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
            archive.writestr(zip_info(PREFIX / GENERATED_PATH, timestamp, 0o100644), metadata)
            for path, raw_mode, object_id in entries:
                data = git(repository, "cat-file", "blob", object_id)
                archive.writestr(
                    zip_info(destinations[path], timestamp, int(raw_mode, 8)),
                    data,
                )
        partial.replace(output)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--git-sha", required=True)
    parser.add_argument("--build-time", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    build(parse_arguments())
