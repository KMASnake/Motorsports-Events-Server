#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="$(tr -d '\r\n' < VERSION)"
DIST="${ROOT}/dist"
ARCHIVE="${DIST}/motorsports-events-server-${VERSION}.zip"

"${ROOT}/scripts/validate-repository.sh"

mkdir -p "${DIST}"
rm -f "${ARCHIVE}" "${ARCHIVE}.sha256"

python3 - "${ROOT}" "${ARCHIVE}" <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import sys

root = Path(sys.argv[1])
output = Path(sys.argv[2])
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
