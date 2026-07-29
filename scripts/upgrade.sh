#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

if [[ $# -ne 1 ]]; then
  echo "Usage : sudo ./upgrade.sh /chemin/version.zip"
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Exécutez avec sudo."
  exit 1
fi

ARCHIVE="$(readlink -f "$1")"
if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Archive introuvable : ${ARCHIVE}"
  exit 1
fi

"${PROJECT_ROOT}/scripts/preflight-upgrade.sh" "${ARCHIVE}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
PARENT_DIR="$(dirname "${PROJECT_ROOT}")"
PROJECT_NAME="$(basename "${PROJECT_ROOT}")"
ROLLBACK_DIR="${PARENT_DIR}/${PROJECT_NAME}-rollback-${TIMESTAMP}"
STAGING_DIR="${PARENT_DIR}/${PROJECT_NAME}-staging-${TIMESTAMP}"
ENV_BACKUP="${PARENT_DIR}/.${PROJECT_NAME}.env-${TIMESTAMP}"
DB_BACKUP="${PROJECT_ROOT}/backups/pre-upgrade-${TIMESTAMP}.sql.gz"

cleanup() {
  rm -rf "${STAGING_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Préparation de la mise à niveau…"
mkdir -p "${PROJECT_ROOT}/backups"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  cp -a "${PROJECT_ROOT}/.env" "${ENV_BACKUP}"
fi

echo "Sauvegarde PostgreSQL…"
if docker compose ps db --status running >/dev/null 2>&1; then
  POSTGRES_USER="$(
    python3 "${PROJECT_ROOT}/scripts/env_get.py" \
      POSTGRES_USER --env "${PROJECT_ROOT}/.env" --required
  )"
  POSTGRES_DB="$(
    python3 "${PROJECT_ROOT}/scripts/env_get.py" \
      POSTGRES_DB --env "${PROJECT_ROOT}/.env" --required
  )"

  docker compose exec -T db \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    | gzip -9 > "${DB_BACKUP}"
fi

echo "Extraction de la nouvelle version…"
mkdir -p "${STAGING_DIR}"
unzip -q "${ARCHIVE}" -d "${STAGING_DIR}"

NEW_ROOT="$(
  find "${STAGING_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1
)"

if [[ -z "${NEW_ROOT}" || ! -f "${NEW_ROOT}/install.sh" ]]; then
  echo "Archive invalide : install.sh absent."
  exit 1
fi

echo "Arrêt de la version actuelle…"
docker compose --profile vps down || docker compose down

echo "Création du point de rollback…"
mv "${PROJECT_ROOT}" "${ROLLBACK_DIR}"
mv "${NEW_ROOT}" "${PROJECT_ROOT}"

restore_previous() {
  echo "Échec de la nouvelle version, rollback en cours…"
  cd "${PARENT_DIR}"
  rm -rf "${PROJECT_ROOT}"
  mv "${ROLLBACK_DIR}" "${PROJECT_ROOT}"
  cd "${PROJECT_ROOT}"

  if [[ -f "${ENV_BACKUP}" ]]; then
    cp -a "${ENV_BACKUP}" "${PROJECT_ROOT}/.env"
  fi

  docker compose --profile vps build --no-cache --pull
  docker compose --profile vps up -d
  echo "Rollback terminé."
  exit 1
}

trap restore_previous ERR

if [[ -f "${ENV_BACKUP}" ]]; then
  cp -a "${ENV_BACKUP}" "${PROJECT_ROOT}/.env"
fi

mkdir -p "${PROJECT_ROOT}/data" "${PROJECT_ROOT}/backups" "${PROJECT_ROOT}/logs"

# Preserve persistent data from the previous installation.
if [[ -d "${ROLLBACK_DIR}/data" ]]; then
  rm -rf "${PROJECT_ROOT}/data"
  mv "${ROLLBACK_DIR}/data" "${PROJECT_ROOT}/data"
fi

if [[ -d "${ROLLBACK_DIR}/backups" ]]; then
  cp -a "${ROLLBACK_DIR}/backups/." "${PROJECT_ROOT}/backups/"
fi

cd "${PROJECT_ROOT}"
chmod +x install.sh scripts/*.sh ./*.sh 2>/dev/null || true

echo "Suppression des anciennes images du projet…"
docker image rm \
  motorsports-events-server-api \
  motorsports-events-server-scheduler \
  2>/dev/null || true
docker builder prune -f

echo "Reconstruction sans cache…"
docker compose --profile vps build --no-cache --pull
docker compose --profile vps up -d

API_DOMAIN="$(
  python3 "${PROJECT_ROOT}/scripts/env_get.py" \
    API_DOMAIN --env "${PROJECT_ROOT}/.env" --required
)"

echo "Contrôle de santé…"
python3 "${PROJECT_ROOT}/scripts/healthcheck.py" \
  --url "https://${API_DOMAIN}" \
  --attempts 40 \
  --delay 5

EXPECTED_VERSION="$(cat "${PROJECT_ROOT}/VERSION")"
RUNNING_VERSION="$(
  curl -fsS "https://${API_DOMAIN}/api/v1/version" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))'
)"

if [[ "${EXPECTED_VERSION}" != "${RUNNING_VERSION}" ]]; then
  echo "Version attendue : ${EXPECTED_VERSION}"
  echo "Version exécutée : ${RUNNING_VERSION}"
  false
fi

trap - ERR
echo
echo "Mise à niveau réussie."
echo "Version : ${RUNNING_VERSION}"
echo "Rollback conservé dans : ${ROLLBACK_DIR}"
echo "Sauvegarde base : ${DB_BACKUP}"
