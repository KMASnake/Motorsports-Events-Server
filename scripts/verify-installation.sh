#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

API_DOMAIN="$(
  python3 "${PROJECT_ROOT}/scripts/env_get.py" \
    API_DOMAIN --env "${PROJECT_ROOT}/.env" --required
)"

PUBLIC_KEY="$(
  python3 "${PROJECT_ROOT}/scripts/env_get.py" \
    PUBLIC_API_KEY --env "${PROJECT_ROOT}/.env" --required
)"

echo "Version locale : $(cat VERSION)"
echo "Version API :"
curl -fsS "https://${API_DOMAIN}/api/v1/version"
echo

echo "État Docker :"
docker compose --profile vps ps
echo

echo "Version du schéma :"
docker compose run --rm --no-deps migrate \
  python -m app.schema_migrations check
echo

echo "Santé API :"
curl -fsS "https://${API_DOMAIN}/api/v1/health"
echo

echo "Sports :"
curl -fsS \
  -H "X-Api-Key: ${PUBLIC_KEY}" \
  "https://${API_DOMAIN}/api/v1/sports"
echo
