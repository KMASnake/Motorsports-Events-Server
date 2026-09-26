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
echo "Sauvegarde restaurée et vérifiée dans une base jetable."
echo "La restauration de la base préproduction active est interdite par ce script."
