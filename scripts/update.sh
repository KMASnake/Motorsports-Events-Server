#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
"${PROJECT_ROOT}/scripts/backup.sh"
compose pull
compose build --pull
compose up -d --remove-orphans
docker image prune -f
compose ps
