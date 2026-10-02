#!/usr/bin/env bash
# Local, no-provider-network proof of the production one-shot handoff gate.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test -z "${DATABASE_URL:-}${DOCKER_HOST:-}${DOCKER_CONTEXT:-}${PROVIDER_MASTER_KEYS:-}${PROVIDER_ACTIVE_KEY_VERSION:-}" || {
  echo 'F57D gate refuses inherited database/Docker/real-key configuration.' >&2; exit 1;
}
CONTAINER="mse-f57d0b-gate-${RANDOM}-$$"
OWNER="${CONTAINER}"
docker_local(){ docker --host unix:///var/run/docker.sock "$@"; }
cleanup(){
  local rc=$? ids
  trap - EXIT INT TERM
  ids="$(docker_local ps -aq --filter "label=mse.f57d0b.owner=${OWNER}")" || exit 1
  if test -n "${ids}"; then
    test "$(docker_local inspect --format '{{ index .Config.Labels "mse.f57d0b.owner" }}' "${CONTAINER}")" = "${OWNER}" || exit 1
    docker_local rm -f -v "${CONTAINER}" >/dev/null || exit 1
  fi
  test -z "$(docker_local ps -aq --filter "label=mse.f57d0b.owner=${OWNER}")" || exit 1
  test -z "$(docker_local volume ls -q --filter "label=mse.f57d0b.owner=${OWNER}")" || exit 1
  test -z "$(docker_local network ls -q --filter "label=mse.f57d0b.owner=${OWNER}")" || exit 1
  echo 'F57D_GATE_CLEANUP containers=0 networks=0 volumes=0'
  exit "${rc}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker_local run --pull=never -d --name "${CONTAINER}" --label "mse.f57d0b.owner=${OWNER}" \
  --network bridge --publish 127.0.0.1::5432/tcp --read-only \
  --tmpfs /var/lib/postgresql/data --tmpfs /var/run/postgresql --tmpfs /tmp \
  -e POSTGRES_DB=f57d0b_gate -e POSTGRES_USER=mse -e POSTGRES_PASSWORD=f57d0b-local-only \
  -v "${ROOT}/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -v "${ROOT}/infra/postgres/migrations:/migrations:ro" postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  # The entrypoint temporarily starts PostgreSQL during init and then stops it.
  # Wait for its final exec as PID 1, not merely that transient init socket.
  docker_local exec "${CONTAINER}" sh -ceu 'test "$(cat /proc/1/comm)" = postgres; pg_isready -U mse -d f57d0b_gate' >/dev/null 2>&1 && break
  sleep 1
done
docker_local exec "${CONTAINER}" pg_isready -U mse -d f57d0b_gate >/dev/null
BINDING="$(docker_local port "${CONTAINER}" 5432/tcp)"
[[ "${BINDING}" =~ ^127\.0\.0\.1:([0-9]+)$ ]] || { echo 'F57D unsafe PostgreSQL binding.' >&2; exit 1; }
PORT="${BASH_REMATCH[1]}"
((PORT > 0 && PORT <= 65535)) || exit 1
docker_local exec "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d f57d0b_gate"
  $psql -c "create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now())" >/dev/null
  for file in /migrations/*.up.sql; do
    $psql -1 -f "$file" >/dev/null
    test "$(basename "$file")" != 0040_f5_canonical_timezone_nullability.up.sql || break
  done
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0040_f5_canonical_timezone_nullability
'
cd "${ROOT}"
DATABASE_URL="postgresql://mse:f57d0b-local-only@127.0.0.1:${PORT}/f57d0b_gate" \
  RUN_F57D_HANDOFF_POSTGRES=1 PREVIEW_API_ENABLED=false \
  npm run test --workspace @mse/api -- --run tests/f57dHandoffGate.postgres.test.ts
