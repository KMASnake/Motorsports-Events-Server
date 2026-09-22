#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE="${MOTORSPORTS_ENV_FILE:-${PROJECT_ROOT}/.env}"
INHERITED_COMPOSE_FILE="${COMPOSE_FILE:-}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
PREPROD_ENV_FILE="${PROJECT_ROOT}/.env.preprod"
PREPROD_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.preprod.yml"
RELEASE_BUILD_ENV_FILE="${PROJECT_ROOT}/dist/release-build.env"
BACKUP_DIR="${MOTORSPORTS_BACKUP_DIR:-${PROJECT_ROOT}/backups}"
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

require_preprod_context() {
  if [[ -n "${INHERITED_COMPOSE_FILE}" ]]; then
    echo "Refus : COMPOSE_FILE externe incompatible avec le contexte préproduction canonique." >&2
    return 1
  fi
  if [[ -n "${COMPOSE_PROJECT_NAME:-}" && "${COMPOSE_PROJECT_NAME}" != "mse-preprod" ]]; then
    echo "Refus : COMPOSE_PROJECT_NAME doit être mse-preprod." >&2
    return 1
  fi
  if [[ -n "${DOCKER_HOST:-}" || -n "${DOCKER_CONTEXT:-}" ]]; then
    echo "Refus : DOCKER_HOST et DOCKER_CONTEXT doivent être absents du contexte préproduction canonique." >&2
    return 1
  fi
  if [[ ! -f "${PREPROD_ENV_FILE}" ]]; then
    echo "Refus : fichier .env.preprod absent." >&2
    return 1
  fi
  if [[ ! -f "${COMPOSE_FILE}" || ! -f "${PREPROD_COMPOSE_FILE}" ]]; then
    echo "Refus : fichiers Compose préproduction absents." >&2
    return 1
  fi
}

require_disposable_database_name() {
  local candidate="${1:-}"
  local active="${2:-}"
  if [[ -z "${active}" ]]; then
    echo "Refus : nom de base préproduction active absent." >&2
    return 1
  fi
  if [[ ! "${candidate}" =~ ^motorsports_backup_check_[0-9]{14}_[0-9]+$ ]]; then
    echo "Refus : nom de base de vérification invalide." >&2
    return 1
  fi
  if [[ "${candidate}" == "${active}" ]]; then
    echo "Refus : la base jetable ne peut pas être la base préproduction active." >&2
    return 1
  fi
}

preprod_compose() {
  require_preprod_context
  docker compose \
    --env-file "${PREPROD_ENV_FILE}" \
    -p mse-preprod \
    -f "${COMPOSE_FILE}" \
    -f "${PREPROD_COMPOSE_FILE}" \
    "$@"
}

preprod_release_compose() {
  require_preprod_context
  if [[ ! -f "${RELEASE_BUILD_ENV_FILE}" ]]; then
    echo "Refus : dist/release-build.env absent ; construire la release avant les images." >&2
    return 1
  fi
  docker compose \
    --env-file "${PREPROD_ENV_FILE}" \
    --env-file "${RELEASE_BUILD_ENV_FILE}" \
    -p mse-preprod \
    -f "${COMPOSE_FILE}" \
    -f "${PREPROD_COMPOSE_FILE}" \
    "$@"
}
