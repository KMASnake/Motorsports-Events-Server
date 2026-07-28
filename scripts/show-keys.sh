#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
for key in API_DOMAIN PUBLIC_API_KEY ADMIN_API_KEY; do
  value="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" "${key}" --env "${ENV_FILE}" --required)"
  printf "%s=%s\n" "${key}" "${value}"
done
