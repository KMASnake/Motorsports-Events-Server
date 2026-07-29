#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
docker compose --profile vps -f "${COMPOSE_FILE}" \
  -f "${PROJECT_ROOT}/docker-compose.monitoring.yml" ps prometheus grafana
