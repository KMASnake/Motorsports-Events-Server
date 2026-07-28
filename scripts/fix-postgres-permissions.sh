#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Exécutez ce script avec sudo."
  exit 1
fi

DATA_DIR="${PROJECT_ROOT}/data"
POSTGRES_DIR="${DATA_DIR}/postgres"
EXPECTED_UID="70"
EXPECTED_GID="70"

if command -v docker >/dev/null 2>&1; then
  IDENTITY="$(
    docker run --rm --entrypoint sh postgres:16-alpine \
      -c 'printf "%s:%s" "$(id -u postgres)" "$(id -g postgres)"' \
      2>/dev/null || true
  )"
  if [[ "${IDENTITY}" =~ ^[0-9]+:[0-9]+$ ]]; then
    EXPECTED_UID="${IDENTITY%%:*}"
    EXPECTED_GID="${IDENTITY##*:}"
  fi
fi

echo "Arrêt de la plateforme…"
docker compose --profile vps down 2>/dev/null || docker compose down

mkdir -p "${POSTGRES_DIR}"
chown root:root "${DATA_DIR}"
chmod 755 "${DATA_DIR}"
chown -R "${EXPECTED_UID}:${EXPECTED_GID}" "${POSTGRES_DIR}"
find "${POSTGRES_DIR}" -type d -exec chmod 700 {} \;
find "${POSTGRES_DIR}" -type f -exec chmod 600 {} \;
chmod 700 "${POSTGRES_DIR}"

echo "Redémarrage de la plateforme…"
docker compose --profile vps up -d 2>/dev/null || docker compose up -d

echo "Permissions PostgreSQL corrigées."
