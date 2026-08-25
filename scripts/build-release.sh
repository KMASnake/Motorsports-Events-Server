#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="${APP_VERSION:-$(tr -d '\r\n' < VERSION)}"
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD)}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
DIST="${ROOT}/dist"
ARCHIVE="${DIST}/motorsports-events-server-${VERSION}.zip"
BUILD_ENV="${DIST}/release-build.env"

"${ROOT}/scripts/validate-repository.sh"

mkdir -p "${DIST}"
rm -f "${ARCHIVE}" "${ARCHIVE}.sha256" "${BUILD_ENV}"

printf 'APP_VERSION=%s\nGIT_SHA=%s\nBUILD_TIME=%s\n' \
  "${VERSION}" "${GIT_SHA}" "${BUILD_TIME}" > "${BUILD_ENV}"

python3 - "${ROOT}" "${ARCHIVE}" "${VERSION}" "${GIT_SHA}" "${BUILD_TIME}" <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import json
import sys

root = Path(sys.argv[1])
output = Path(sys.argv[2])
version, git_sha, build_time = sys.argv[3:6]
ignored = {
    ".git",
    ".venv",
    ".pytest_cache",
    "__pycache__",
    "dist",
    "data",
    "backups",
    "logs",
}

with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    archive.writestr(
        "motorsports-events-server/release-metadata.json",
        json.dumps({"version": version, "git_sha": git_sha, "build_time": build_time}, indent=2) + "\n",
    )
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in ignored for part in path.parts):
            continue
        if path.name == ".env":
            continue

        archive.write(
            path,
            Path("motorsports-events-server") / path.relative_to(root),
        )
PY

(
  cd "${DIST}"
  sha256sum "$(basename "${ARCHIVE}")" \
    > "$(basename "${ARCHIVE}").sha256"
)

echo "Release créée : ${ARCHIVE}"
echo "Empreinte : ${ARCHIVE}.sha256"
echo "Build Docker reproductible : docker compose --env-file ${BUILD_ENV} build api worker"
