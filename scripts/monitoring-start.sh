#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

GRAFANA_ADMIN_PASSWORD="$(
  python3 "${PROJECT_ROOT}/scripts/env_get.py" \
    GRAFANA_ADMIN_PASSWORD --env "${ENV_FILE}" --required
)" || true
if [[ -z "${GRAFANA_ADMIN_PASSWORD}" ]]; then
  echo "Définissez GRAFANA_ADMIN_PASSWORD dans .env."
  exit 1
fi

docker compose --profile vps \
  -f "${COMPOSE_FILE}" \
  -f "${PROJECT_ROOT}/docker-compose.monitoring.yml" \
  up -d prometheus grafana
echo "Grafana privé : utilisez un tunnel SSH vers 127.0.0.1:3000."
