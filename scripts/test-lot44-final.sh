#!/bin/sh
set -eu

BASE_PROJECT=${LOT44_FINAL_PROJECT:-mse-lot44-final}

cleanup_project() {
  COMPOSE_PROJECT_NAME="$1" docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}

echo "Nettoyage des piles Lot 4.4 connues..."
cleanup_project "$BASE_PROJECT-foundation"
cleanup_project "$BASE_PROJECT-api"
cleanup_project "$BASE_PROJECT-ui"

echo "Validation locale Node dans un conteneur..."
docker run --rm \
  -v "$PWD:/source:ro" \
  -w /tmp/project \
  node:22-alpine \
  sh -lc 'cp -a /source/. . && npm ci && npm audit --audit-level=high && npm run lint && npm run typecheck && npm test && npm run build'

./scripts/validate-repository.sh

LOT44_PROJECT="$BASE_PROJECT-foundation" \
LOT44_POSTGRES_PORT=${LOT44_FOUNDATION_POSTGRES_PORT:-55467} \
./scripts/test-lot44-auth-foundation.sh

LOT44_PROJECT="$BASE_PROJECT-api" \
LOT44_POSTGRES_PORT=${LOT44_API_POSTGRES_PORT:-55468} \
LOT44_API_PORT=${LOT44_API_PORT:-3581} \
./scripts/test-lot44-auth-api.sh

LOT44_UI_PROJECT="$BASE_PROJECT-ui" \
LOT44_UI_POSTGRES_PORT=${LOT44_UI_POSTGRES_PORT:-55469} \
LOT44_UI_API_PORT=${LOT44_UI_API_PORT:-3591} \
LOT44_UI_WEB_PORT=${LOT44_UI_WEB_PORT:-3590} \
./scripts/test-lot44-auth-ui.sh

echo "Recette finale Lot 4.4 : OK"
