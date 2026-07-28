#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fichier .env absent."
  exit 1
fi

POSTGRES_USER="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_USER --env "${ENV_FILE}" --required)"
POSTGRES_DB="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_DB --env "${ENV_FILE}" --required)"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/motorsports-events-${STAMP}.sql.gz"

compose exec -T db pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  | gzip -9 > "${FILE}"

chmod 600 "${FILE}"
find "${BACKUP_DIR}" -type f -name 'motorsports-events-*.sql.gz' -mtime +30 -delete
echo "Sauvegarde créée : ${FILE}"
