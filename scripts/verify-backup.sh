#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage : $0 backups/fichier.sql.gz"
  exit 1
fi

FILE="$1"
[[ "${FILE}" != /* ]] && FILE="${PROJECT_ROOT}/${FILE}"

if [[ ! -s "${FILE}" ]]; then
  echo "Sauvegarde absente ou vide : ${FILE}"
  exit 1
fi

gzip -t "${FILE}"

POSTGRES_USER="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_USER --env "${ENV_FILE}" --required)"
CHECK_DB="motorsports_backup_check_$(date +%Y%m%d%H%M%S)_$$"

cleanup() {
  compose exec -T db dropdb \
    -U "${POSTGRES_USER}" \
    --if-exists "${CHECK_DB}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

compose exec -T db createdb -U "${POSTGRES_USER}" "${CHECK_DB}"
gzip -dc "${FILE}" | compose exec -T db psql \
  -v ON_ERROR_STOP=1 \
  -U "${POSTGRES_USER}" \
  -d "${CHECK_DB}" \
  >/dev/null

TABLES="$(compose exec -T db psql \
  -U "${POSTGRES_USER}" \
  -d "${CHECK_DB}" \
  -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"

if [[ ! "${TABLES}" =~ ^[0-9]+$ ]] || (( TABLES == 0 )); then
  echo "Sauvegarde restaurée sans table publique."
  exit 1
fi

echo "Sauvegarde vérifiée par restauration temporaire : ${FILE}"
