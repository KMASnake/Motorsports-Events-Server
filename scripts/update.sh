#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
"${PROJECT_ROOT}/scripts/backup.sh"
"${PROJECT_ROOT}/scripts/build-release.sh"
preprod_release_compose config --quiet
preprod_release_compose pull postgres prometheus
preprod_release_compose build --pull api web
preprod_compose up -d --wait postgres
preprod_compose run --rm migrate
preprod_compose up -d --wait api web prometheus
preprod_compose ps postgres api web prometheus
