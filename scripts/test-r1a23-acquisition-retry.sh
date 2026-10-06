#!/usr/bin/env bash
# Local, no-provider-network proof of durable acquisition retry state.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test -z "${DATABASE_URL:-}${DOCKER_HOST:-}${DOCKER_CONTEXT:-}${PROVIDER_MASTER_KEYS:-}${PROVIDER_ACTIVE_KEY_VERSION:-}" || {
  echo 'R1A23 gate refuses inherited database/Docker/real-key configuration.' >&2; exit 1;
}
CONTAINER="mse-r1a23-gate-${RANDOM}-$$"
OWNER="${CONTAINER}"
docker_local(){ docker --host unix:///var/run/docker.sock "$@"; }
verify_cleanup_zero(){
  local resource="$1" result query_rc
  shift
  if result="$(docker_local "$@")"; then
    query_rc=0
  else
    query_rc=$?
    printf 'DOCKER_QUERY_FAILED resource=%s query_rc=%s\n' "${resource}" "${query_rc}" >&2
    return "${query_rc}"
  fi
  if test -n "${result}"; then
    printf 'RESOURCE_COUNT_NONZERO resource=%s query_rc=%s\n' "${resource}" "${query_rc}" >&2
    return 1
  fi
  printf 'CLEANUP_VERIFIED_ZERO resource=%s query_rc=%s\n' "${resource}" "${query_rc}"
}
cleanup(){
  local rc=$? ids
  trap - EXIT INT TERM
  ids="$(docker_local ps -aq --filter "label=mse.r1a23.owner=${OWNER}")" || exit 1
  if test -n "${ids}"; then
    test "$(docker_local inspect --format '{{ index .Config.Labels "mse.r1a23.owner" }}' "${CONTAINER}")" = "${OWNER}" || exit 1
    docker_local rm -f -v "${CONTAINER}" >/dev/null || exit 1
  fi
  verify_cleanup_zero containers ps -aq --filter "label=mse.r1a23.owner=${OWNER}" || exit 1
  verify_cleanup_zero volumes volume ls -q --filter "label=mse.r1a23.owner=${OWNER}" || exit 1
  verify_cleanup_zero networks network ls -q --filter "label=mse.r1a23.owner=${OWNER}" || exit 1
  echo 'R1A23_GATE_CLEANUP containers=0 networks=0 volumes=0'
  exit "${rc}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker_local run --pull=never -d --name "${CONTAINER}" --label "mse.r1a23.owner=${OWNER}" \
  --network bridge --publish 127.0.0.1::5432/tcp --read-only \
  --tmpfs /var/lib/postgresql/data --tmpfs /var/run/postgresql --tmpfs /tmp \
  -e POSTGRES_DB=r1a23_gate -e POSTGRES_USER=mse -e POSTGRES_PASSWORD=r1a23-local-only \
  -v "${ROOT}/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -v "${ROOT}/infra/postgres/migrations:/migrations:ro" postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  # The entrypoint temporarily starts PostgreSQL during init and then stops it.
  # Wait for its final exec as PID 1, not merely that transient init socket.
  docker_local exec "${CONTAINER}" sh -ceu 'test "$(cat /proc/1/comm)" = postgres; pg_isready -U mse -d r1a23_gate' >/dev/null 2>&1 && break
  sleep 1
done
docker_local exec "${CONTAINER}" pg_isready -U mse -d r1a23_gate >/dev/null
BINDING="$(docker_local port "${CONTAINER}" 5432/tcp)"
[[ "${BINDING}" =~ ^127\.0\.0\.1:([0-9]+)$ ]] || { echo 'R1A23 unsafe PostgreSQL binding.' >&2; exit 1; }
PORT="${BASH_REMATCH[1]}"
((PORT > 0 && PORT <= 65535)) || exit 1
docker_local exec "${CONTAINER}" sh -ceu '
  psql="psql -v ON_ERROR_STOP=1 -U mse -d r1a23_gate"
  $psql -c "create table if not exists schema_migrations(version text primary key,applied_at timestamptz not null default now())" >/dev/null
  for file in /migrations/*.up.sql; do
    $psql -1 -f "$file" >/dev/null
    test "$(basename "$file")" != 0042_acquisition_retry_state.up.sql || break
  done
  test "$($psql -Atc "select version from schema_migrations order by version desc limit 1")" = 0042_acquisition_retry_state
  $psql -1 -f /migrations/0042_acquisition_retry_state.down.sql >/dev/null
  $psql -1 -f /migrations/0042_acquisition_retry_state.up.sql >/dev/null
  sh /migrations/migrate.sh up >/dev/null
  sh /migrations/migrate.sh up >/dev/null
'
cd "${ROOT}"
npm run build --workspace @mse/api
DATABASE_URL="postgresql://mse:r1a23-local-only@127.0.0.1:${PORT}/r1a23_gate" \
  RUN_R1_A2_3_RETRY_POSTGRES=1 PREVIEW_API_ENABLED=false \
  npm run test --workspace @mse/api -- --run tests/acquisitionRetryResume.postgres.test.ts
