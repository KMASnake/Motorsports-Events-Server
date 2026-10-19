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
require_preprod_context

POSTGRES_USER="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_USER --env "${PREPROD_ENV_FILE}" --required)"
POSTGRES_DB="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_DB --env "${PREPROD_ENV_FILE}" --required)"
CHECK_DB="motorsports_backup_check_$(date +%Y%m%d%H%M%S)_$$"
require_disposable_database_name "${CHECK_DB}" "${POSTGRES_DB}"
CHECK_DB_CREATED=false

cleanup() {
  if [[ "${CHECK_DB_CREATED}" == "true" ]]; then
    preprod_compose exec -T postgres dropdb \
      -U "${POSTGRES_USER}" \
      --if-exists "${CHECK_DB}" >/dev/null
  fi
}
trap cleanup EXIT

preprod_compose exec -T postgres createdb -U "${POSTGRES_USER}" "${CHECK_DB}"
CHECK_DB_CREATED=true
gzip -dc "${FILE}" | preprod_compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U "${POSTGRES_USER}" \
  -d "${CHECK_DB}" \
  >/dev/null

TABLES="$(preprod_compose exec -T postgres psql \
  -U "${POSTGRES_USER}" \
  -d "${CHECK_DB}" \
  -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"

if [[ ! "${TABLES}" =~ ^[0-9]+$ ]] || (( TABLES == 0 )); then
  echo "Sauvegarde restaurée sans table publique."
  exit 1
fi

echo "Sauvegarde vérifiée par restauration temporaire : ${FILE}"
