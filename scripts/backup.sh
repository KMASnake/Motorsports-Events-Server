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
PARTIAL="${FILE}.partial"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

trap 'rm -f "${PARTIAL}"' EXIT
compose exec -T db pg_dump \
  --no-owner \
  --no-privileges \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  | gzip -9 > "${PARTIAL}"

gzip -t "${PARTIAL}"
[[ -s "${PARTIAL}" ]]
mv "${PARTIAL}" "${FILE}"
chmod 600 "${FILE}"

"${PROJECT_ROOT}/scripts/verify-backup.sh" "${FILE}"

find "${BACKUP_DIR}" -type f -name 'motorsports-events-*.sql.gz' \
  -mtime "+${RETENTION_DAYS}" -delete
echo "Sauvegarde créée : ${FILE}"
