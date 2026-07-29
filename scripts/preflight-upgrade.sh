#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage : $0 /chemin/version.zip"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$(readlink -f "$1")"

for command in docker python3 unzip gzip curl find df du awk sort grep wc; do
  command -v "${command}" >/dev/null || {
    echo "Prérequis absent : ${command}"
    exit 1
  }
done

[[ -f "${ARCHIVE}" && -r "${ARCHIVE}" ]] || {
  echo "Archive absente ou illisible : ${ARCHIVE}"
  exit 1
}
unzip -tq "${ARCHIVE}" >/dev/null
[[ -s "${PROJECT_ROOT}/.env" ]] || {
  echo "Fichier .env absent ou vide."
  exit 1
}
docker info >/dev/null
docker compose version >/dev/null
docker compose config --quiet

ARCHIVE_KB="$(du -Pk "${ARCHIVE}" | awk '{print $1}')"
DATA_KB="$(du -sk "${PROJECT_ROOT}/data" 2>/dev/null | awk '{print $1}')"
DATA_KB="${DATA_KB:-0}"
AVAILABLE_KB="$(df -Pk "$(dirname "${PROJECT_ROOT}")" | awk 'NR==2 {print $4}')"
REQUIRED_KB="$((ARCHIVE_KB * 4 + DATA_KB * 2 + 512000))"
if (( AVAILABLE_KB < REQUIRED_KB )); then
  echo "Espace disque insuffisant : ${AVAILABLE_KB} Kio disponibles, ${REQUIRED_KB} requis."
  exit 1
fi

ARCHIVE_LIST="$(unzip -Z1 "${ARCHIVE}")"
TOP_LEVEL="$(
  printf '%s\n' "${ARCHIVE_LIST}" |
    awk -F/ 'NF {print $1}' |
    sort -u
)"
[[ "$(printf '%s\n' "${TOP_LEVEL}" | wc -l)" -eq 1 ]] || {
  echo "Archive invalide : plusieurs racines."
  exit 1
}
for required in VERSION install.sh docker-compose.yml scripts/upgrade.sh; do
  grep -qx "${TOP_LEVEL}/${required}" <<<"${ARCHIVE_LIST}" || {
    echo "Archive invalide : ${required} absent."
    exit 1
  }
done

echo "Prérequis de mise à niveau : OK"
