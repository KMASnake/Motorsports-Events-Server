#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="mse-f57b-postgres-${RANDOM}-$$"
IMAGE="${F57B_POSTGRES_IMAGE:-postgres:17-alpine}"
cleanup(){ docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

docker run -d --name "${CONTAINER}" --publish 127.0.0.1::5432 \
  -e POSTGRES_DB=f57b -e POSTGRES_USER=mse -e POSTGRES_PASSWORD=f57b-local-only \
  -v "${ROOT}/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -v "${ROOT}/infra/postgres/migrations:/migrations:ro" "${IMAGE}" >/dev/null

for _ in $(seq 1 60);do docker exec -e PGPASSWORD=f57b-local-only "${CONTAINER}" pg_isready -U mse -d f57b >/dev/null 2>&1&&break;sleep 1;done
docker exec -e PGPASSWORD=f57b-local-only "${CONTAINER}" pg_isready -U mse -d f57b >/dev/null

docker exec -e PGPASSWORD=f57b-local-only "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d f57b"
  $psql -c "create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now())" >/dev/null
  for file in /migrations/*.up.sql;do
    version="$(basename "$file" .up.sql)"
    test "$version" = 0038_f5_canonical_publication&&break
    $psql -1 -f "$file" >/dev/null
  done
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0037_f5_multi_provider_reconciliation
  before="$($psql -Atc "select count(*)||'"'"':'"'"'||coalesce(max(sequence),0) from public_change_log")"
  $psql -1 -f /migrations/0038_f5_canonical_publication.up.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0038_f5_canonical_publication
  test "$($psql -Atc "select count(*)||'"'"':'"'"'||coalesce(max(sequence),0) from public_change_log")" = "$before"
  $psql -1 -f /migrations/0038_f5_canonical_publication.down.sql >/dev/null
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0037_f5_multi_provider_reconciliation
  $psql -1 -f /migrations/0038_f5_canonical_publication.up.sql >/dev/null
'

PORT="$(docker port "${CONTAINER}" 5432/tcp | sed -n 's/^127\.0\.0\.1:\([0-9][0-9]*\)$/\1/p')"
test -n "${PORT}"
DATABASE_URL="postgresql://mse:f57b-local-only@127.0.0.1:${PORT}/f57b" RUN_F57B_POSTGRES=1 \
  npm run test --workspace @mse/api -- --run tests/canonicalCatalogPublication.postgres.test.ts
if docker exec -e PGPASSWORD=f57b-local-only "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse -d f57b -1 -f /migrations/0038_f5_canonical_publication.down.sql >/dev/null 2>&1;then
  echo "F5-7B populated DOWN unexpectedly succeeded" >&2;exit 1
fi
test "$(docker exec -e PGPASSWORD=f57b-local-only "${CONTAINER}" psql -At -U mse -d f57b -c "select version from schema_migrations order by version desc limit 1")" = 0038_f5_canonical_publication

echo 'F5-7B canonical publication migration and service: PASS'
