#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="${APP_VERSION:-$(tr -d '\r\n' < VERSION)}"
SOURCE_SHA="$(git rev-parse --verify 'HEAD^{commit}')"
GIT_SHA="${GIT_SHA:-${SOURCE_SHA}}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
DIST="${ROOT}/dist"
ARCHIVE="${DIST}/motorsports-events-server-${VERSION}.zip"
BUILD_ENV="${DIST}/release-build.env"

if [[ "${GIT_SHA}" != "${SOURCE_SHA}" ]]; then
  echo "GIT_SHA doit identifier exactement le commit HEAD empaqueté." >&2
  exit 1
fi

"${ROOT}/scripts/validate-repository.sh"

mkdir -p "${DIST}"
rm -f "${ARCHIVE}" "${ARCHIVE}.sha256" "${BUILD_ENV}"

printf 'APP_VERSION=%s\nGIT_SHA=%s\nBUILD_TIME=%s\n' \
  "${VERSION}" "${GIT_SHA}" "${BUILD_TIME}" > "${BUILD_ENV}"

python3 "${ROOT}/scripts/build-release-archive.py" \
  --repository "${ROOT}" \
  --commit "${SOURCE_SHA}" \
  --output "${ARCHIVE}" \
  --version "${VERSION}" \
  --git-sha "${GIT_SHA}" \
  --build-time "${BUILD_TIME}"

(
  cd "${DIST}"
  sha256sum "$(basename "${ARCHIVE}")" \
    > "$(basename "${ARCHIVE}").sha256"
)

echo "Release créée : ${ARCHIVE}"
echo "Empreinte : ${ARCHIVE}.sha256"
echo "Build Docker reproductible : docker compose --env-file ${BUILD_ENV} build api worker web"
