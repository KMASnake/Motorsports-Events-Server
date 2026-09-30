#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="mse-f57c-postgres-${RANDOM}-$$"
IMAGE="${F57C_POSTGRES_IMAGE:-postgres:17-alpine}"
cleanup(){ docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

test -z "${DATABASE_URL:-}" || { echo 'F5-7C refuses an inherited DATABASE_URL.' >&2; exit 1; }
# The certified F5-6 harness owns its required 0036 -> 0037 legacy-import
# transition. Running it first preserves that proof instead of skipping or
# recreating the imported legacy rows on an already-upgraded schema.
bash "${ROOT}/scripts/test-f5-multi-provider-reconciliation.sh"
docker run -d --name "${CONTAINER}" --label mse.certification=f57c --publish 127.0.0.1::5432 \
  --network bridge --read-only --tmpfs /var/run/postgresql --tmpfs /tmp \
  -e POSTGRES_DB=f57c -e POSTGRES_USER=mse -e POSTGRES_PASSWORD=f57c-local-only \
  -v "${ROOT}/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -v "${ROOT}/infra/postgres/migrations:/migrations:ro" "${IMAGE}" >/dev/null
for _ in $(seq 1 60);do docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" pg_isready -U mse -d f57c >/dev/null 2>&1&&break;sleep 1;done
docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" pg_isready -U mse -d f57c >/dev/null
PORT="$(docker port "${CONTAINER}" 5432/tcp | sed -n 's/^127\.0\.0\.1:\([0-9][0-9]*\)$/\1/p')"
[[ "${PORT}" =~ ^[0-9]+$ ]] || { echo 'F5-7C localhost-only PostgreSQL binding missing.' >&2; exit 1; }

docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d f57c"
  $psql -c "create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now())" >/dev/null
  for file in /migrations/*.up.sql;do $psql -1 -f "$file" >/dev/null; test "$(basename "$file")" != 0038_f5_canonical_publication.up.sql || break; done
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0038_f5_canonical_publication
'

export DATABASE_URL="postgresql://mse:f57c-local-only@127.0.0.1:${PORT}/f57c"
export RUN_F57C_POSTGRES=1
npm run test --workspace @mse/api -- --run tests/f57cEndToEnd.postgres.test.ts
test "$(docker exec -e PGPASSWORD=f57c-local-only "${CONTAINER}" psql -At -U mse -d f57c -c "select version from schema_migrations order by version desc limit 1")" = 0038_f5_canonical_publication
echo 'F5-7C deterministic end-to-end certification: PASS'
