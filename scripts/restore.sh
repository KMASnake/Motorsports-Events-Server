#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage : $0 backups/fichier.sql.gz"
  exit 1
fi

FILE="$1"
[[ "${FILE}" != /* ]] && FILE="${PROJECT_ROOT}/${FILE}"

if [[ ! -f "${FILE}" ]]; then
  echo "Sauvegarde introuvable : ${FILE}"
  exit 1
fi

"${PROJECT_ROOT}/scripts/verify-backup.sh" "${FILE}"

POSTGRES_USER="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_USER --env "${ENV_FILE}" --required)"
POSTGRES_DB="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" POSTGRES_DB --env "${ENV_FILE}" --required)"

read -r -p "Cette opération remplace les données actuelles. Continuer ? [oui/N] " CONFIRM
[[ "${CONFIRM}" != "oui" ]] && exit 1

SERVICES_STOPPED=false
restart_services() {
  if [[ "${SERVICES_STOPPED}" == "true" ]]; then
    compose start api scheduler
  fi
}
trap restart_services EXIT

compose stop api scheduler
SERVICES_STOPPED=true
compose exec -T db dropdb -U "${POSTGRES_USER}" --if-exists "${POSTGRES_DB}"
compose exec -T db createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}"
gzip -dc "${FILE}" | compose exec -T db psql \
  -v ON_ERROR_STOP=1 \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}"
compose start api scheduler
SERVICES_STOPPED=false
echo "Restauration terminée."
