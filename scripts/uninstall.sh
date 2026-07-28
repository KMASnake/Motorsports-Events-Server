#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
read -r -p "Arrêter et supprimer les conteneurs en conservant les données ? [oui/N] " CONFIRM
[[ "${CONFIRM}" != "oui" ]] && exit 1
compose down
echo "Conteneurs supprimés, données conservées."
