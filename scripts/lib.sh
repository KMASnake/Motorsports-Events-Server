#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
BACKUP_DIR="${PROJECT_ROOT}/backups"
DATA_DIR="${PROJECT_ROOT}/data"

detect_environment() {
  python3 "${PROJECT_ROOT}/scripts/detect-environment.py" --plain
}

compose() {
  local env_name="${MOTORSPORTS_ENVIRONMENT:-$(detect_environment)}"
  if [[ "${env_name}" == "vps" ]]; then
    docker compose --profile vps -f "${COMPOSE_FILE}" "$@"
  else
    docker compose -f "${COMPOSE_FILE}" "$@"
  fi
}
