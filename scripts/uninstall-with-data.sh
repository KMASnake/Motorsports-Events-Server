#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
read -r -p "Tapez SUPPRIMER pour effacer conteneurs et données : " CONFIRM
[[ "${CONFIRM}" != "SUPPRIMER" ]] && exit 1
compose down
rm -rf "${DATA_DIR}" "${BACKUP_DIR}" "${PROJECT_ROOT}/logs"
echo "Conteneurs et données supprimés."
