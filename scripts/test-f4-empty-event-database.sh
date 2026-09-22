#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_HEAD=0031_real_circuit_reference_data
POSTGRES_IMAGE=postgres:16.10-bookworm
RUN_ID="$(date -u +%Y%m%d%H%M%S)-${$}-${RANDOM}"
OWNERSHIP_LABEL=com.motorsports-events.f4-4.run
TMP_ROOT="$(mktemp -d /tmp/mse-f4-empty-event-db.XXXXXXXX)"
CLUSTER_DIR="${TMP_ROOT}/postgres"
SOCKET_DIR="${TMP_ROOT}/socket"
MARKER="${TMP_ROOT}/created-by-f4-empty-event-db"
DB_NAME="mse_f4_empty_${$}_$(date -u +%Y%m%d%H%M%S)"
DOCKER_CONTAINER="mse-f4-empty-postgres-${RUN_ID}"
DOCKER_NETWORK="mse-f4-empty-network-${RUN_ID}"
BACKEND=''
API_PID=''
PG_STARTED=false
DOCKER_CONTAINER_CREATED=false
DOCKER_NETWORK_CREATED=false

unset DATABASE_URL PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE
unset PGSERVICE PGSERVICEFILE PGOPTIONS COMPOSE_FILE COMPOSE_PROJECT_NAME

mkdir -p "${CLUSTER_DIR}" "${SOCKET_DIR}"
: > "${MARKER}"

owned_container() {
  [[ "$(docker inspect --format "{{ index .Config.Labels \"${OWNERSHIP_LABEL}\" }}" "${DOCKER_CONTAINER}" 2>/dev/null)" == "${RUN_ID}" ]]
}
owned_network() {
  [[ "$(docker network inspect --format "{{ index .Labels \"${OWNERSHIP_LABEL}\" }}" "${DOCKER_NETWORK}" 2>/dev/null)" == "${RUN_ID}" ]]
}

cleanup() {
  local rc=$? cleanup_safe=true
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
    if kill -0 "${API_PID}" 2>/dev/null; then cleanup_safe=false; rc=1; fi
  fi
  if [[ "${PG_STARTED}" == true && "${BACKEND}" == native ]]; then
    if ! "${PG_CTL}" -D "${CLUSTER_DIR}" -m fast -w stop >/dev/null 2>&1; then cleanup_safe=false; rc=1; fi
  fi
  if [[ "${DOCKER_CONTAINER_CREATED}" == true ]]; then
    if ! owned_container; then
      echo "F4-4 cleanup refused unproven container ownership: ${DOCKER_CONTAINER}" >&2; cleanup_safe=false; rc=1
    elif ! docker rm --force "${DOCKER_CONTAINER}" >/dev/null; then cleanup_safe=false; rc=1
    fi
  fi
  if [[ "${DOCKER_NETWORK_CREATED}" == true ]]; then
    if ! owned_network; then
      echo "F4-4 cleanup refused unproven network ownership: ${DOCKER_NETWORK}" >&2; cleanup_safe=false; rc=1
    elif ! docker network rm "${DOCKER_NETWORK}" >/dev/null; then cleanup_safe=false; rc=1
    fi
  fi
  if [[ ! -f "${MARKER}" || "${TMP_ROOT}" != /tmp/mse-f4-empty-event-db.* ]]; then
    echo "Refusing unsafe cleanup target: ${TMP_ROOT}" >&2; exit 1
  fi
  if [[ "${cleanup_safe}" == true ]]; then rm -rf -- "${TMP_ROOT}"; else
    echo "F4-4 cleanup preserved owned diagnostics at ${TMP_ROOT}." >&2
  fi
  exit "${rc}"
}
trap cleanup EXIT INT TERM

find_pg_binary() {
  local name="$1" candidate=''
  if command -v "${name}" >/dev/null 2>&1; then command -v "${name}"; return; fi
  if command -v pg_config >/dev/null 2>&1; then
    candidate="$(pg_config --bindir)/${name}"
    [[ -x "${candidate}" ]] && { printf '%s\n' "${candidate}"; return; }
  fi
  return 1
}
free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}
require_local_docker() {
  [[ -z "${DOCKER_HOST:-}" && -z "${DOCKER_CONTEXT:-}" ]] || {
    echo 'F4-4 Docker fallback refuses inherited DOCKER_HOST/DOCKER_CONTEXT.' >&2; return 1; }
  command -v docker >/dev/null 2>&1 || { echo 'F4-4 requires native PostgreSQL or local Docker.' >&2; return 1; }
  local context endpoint
  context="$(docker context show)"
  [[ "${context}" == default ]] || { echo "F4-4 refuses non-default Docker context: ${context}" >&2; return 1; }
  endpoint="$(docker context inspect default --format '{{ .Endpoints.docker.Host }}')"
  [[ "${endpoint}" == unix://* ]] || { echo "F4-4 refuses non-local Docker endpoint: ${endpoint}" >&2; return 1; }
}

case "${DB_NAME}" in mse_f4_empty_[0-9]*_[0-9]*) ;; *) echo "Refusing non-disposable database name: ${DB_NAME}" >&2; exit 1 ;; esac
case "${DB_NAME}" in *preprod*|*prod*|*production*|*staging*|motorsports_events)
  echo "Refusing protected database name: ${DB_NAME}" >&2; exit 1 ;; esac

if INITDB="$(find_pg_binary initdb)" && PG_CTL="$(find_pg_binary pg_ctl)" \
  && CREATEDB="$(find_pg_binary createdb)" && PSQL="$(find_pg_binary psql)"; then
  BACKEND=native
  PG_PORT="$(free_port)"
  "${INITDB}" -D "${CLUSTER_DIR}" --username=mse_f4 --auth-local=trust --auth-host=trust >/dev/null
  { printf "listen_addresses = '127.0.0.1'\n"; printf 'port = %s\n' "${PG_PORT}"; printf "unix_socket_directories = '%s'\n" "${SOCKET_DIR}"; } >> "${CLUSTER_DIR}/postgresql.conf"
  "${PG_CTL}" -D "${CLUSTER_DIR}" -w start >/dev/null
  PG_STARTED=true
  PSQL_ADMIN=("${PSQL}" -v ON_ERROR_STOP=1 -h "${SOCKET_DIR}" -p "${PG_PORT}" -U mse_f4 -d postgres)
  [[ "$("${PSQL_ADMIN[@]}" -Atqc "select count(*) from pg_database where datname='${DB_NAME}'")" == 0 ]]
  "${CREATEDB}" -h "${SOCKET_DIR}" -p "${PG_PORT}" -U mse_f4 "${DB_NAME}"
else
  BACKEND=docker
  require_local_docker
  PG_PORT="$(free_port)"
  [[ -z "$(docker container ls -a --filter "name=^/${DOCKER_CONTAINER}$" --format '{{.ID}}')" ]]
  [[ -z "$(docker network ls --filter "name=^${DOCKER_NETWORK}$" --format '{{.ID}}')" ]]
  docker network create --internal --label "${OWNERSHIP_LABEL}=${RUN_ID}" "${DOCKER_NETWORK}" >/dev/null
  DOCKER_NETWORK_CREATED=true
  [[ "$(docker network inspect --format '{{ .Internal }}' "${DOCKER_NETWORK}")" == true ]] && owned_network
  docker create --name "${DOCKER_CONTAINER}" --label "${OWNERSHIP_LABEL}=${RUN_ID}" \
    --network "${DOCKER_NETWORK}" --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
    --publish "127.0.0.1:${PG_PORT}:5432/tcp" --env POSTGRES_USER=mse_f4 --env POSTGRES_DB="${DB_NAME}" \
    --env POSTGRES_HOST_AUTH_METHOD=trust \
    --mount "type=bind,src=${ROOT}/infra/postgres/init,dst=/f4-init,readonly" \
    --mount "type=bind,src=${ROOT}/infra/postgres/migrations,dst=/f4-migrations,readonly" \
    "${POSTGRES_IMAGE}" >/dev/null
  DOCKER_CONTAINER_CREATED=true
  owned_container
  [[ "$(docker inspect --format '{{ len .Mounts }}' "${DOCKER_CONTAINER}")" == 2 ]]
  [[ "$(docker inspect --format '{{ if index .Config.ExposedPorts "5432/tcp" }}5432/tcp{{ end }}' "${DOCKER_CONTAINER}")" == 5432/tcp ]]
  port_bindings="$(docker inspect --format '{{ json (index .HostConfig.PortBindings "5432/tcp") }}' "${DOCKER_CONTAINER}")"
  node -e '
    const bindings=JSON.parse(process.argv[1]);
    const port=process.argv[2];
    if(!Array.isArray(bindings)||bindings.length!==1||bindings[0]?.HostIp!=="127.0.0.1"||bindings[0]?.HostPort!==port) process.exit(1);
  ' "${port_bindings}" "${PG_PORT}"
  docker start "${DOCKER_CONTAINER}" >/dev/null
  for _ in $(seq 1 60); do
    docker exec "${DOCKER_CONTAINER}" pg_isready -U mse_f4 -d "${DB_NAME}" >/dev/null 2>&1 && break
    sleep 0.5
  done
  docker exec "${DOCKER_CONTAINER}" pg_isready -U mse_f4 -d "${DB_NAME}" >/dev/null
  port_binding="$(docker port "${DOCKER_CONTAINER}" 5432/tcp)"
  [[ "${port_binding}" == "127.0.0.1:${PG_PORT}" ]]
fi

db_psql() {
  if [[ "${BACKEND}" == native ]]; then
    "${PSQL}" -v ON_ERROR_STOP=1 -h "${SOCKET_DIR}" -p "${PG_PORT}" -U mse_f4 -d "${DB_NAME}" "$@"
  else
    docker exec -i "${DOCKER_CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse_f4 -d "${DB_NAME}" "$@"
  fi
}

if [[ "${BACKEND}" == native ]]; then
  db_psql -1 -f "${ROOT}/infra/postgres/init/001-bootstrap.sql" >/dev/null
  POSTGRES_USER=mse_f4 POSTGRES_DB="${DB_NAME}" PGHOST="${SOCKET_DIR}" PGPORT="${PG_PORT}" \
    MIGRATIONS_DIR="${ROOT}/infra/postgres/migrations" sh "${ROOT}/infra/postgres/migrations/migrate.sh" up >/dev/null
else
  docker exec "${DOCKER_CONTAINER}" psql -v ON_ERROR_STOP=1 -U mse_f4 -d "${DB_NAME}" -1 -f /f4-init/001-bootstrap.sql >/dev/null
  docker exec -e POSTGRES_USER=mse_f4 -e POSTGRES_DB="${DB_NAME}" -e MIGRATIONS_DIR=/f4-migrations \
    "${DOCKER_CONTAINER}" sh /f4-migrations/migrate.sh up >/dev/null
fi

[[ "$(db_psql -Atqc 'select version from schema_migrations order by applied_at desc,version desc limit 1')" == "${EXPECTED_HEAD}" ]]
[[ "$(db_psql -Atqc 'select count(*) from schema_migrations')" == 31 ]]
db_psql <<'SQL' >/dev/null
do $$
declare table_name text; row_count bigint;
begin
  foreach table_name in array array[
    'events','meetings','meeting_events','sessions','event_corrections','archived_event_corrections','session_corrections',
    'event_source_links','meeting_source_links','normalized_identity_tombstones','normalized_candidates','normalization_decisions','normalization_checkpoints',
    'normalization_mapping_versions','provider_championship_active_normalization_mappings','provider_acquisition_traversal_mappings','provider_championship_source_configs',
    'provider_source_entities','provider_source_observations','provider_source_changes','provider_acquisition_state','provider_acquisition_traversals','provider_acquisition_anomalies',
    'provider_discovered_championships','provider_discovery_runs','sync_streams','sync_runs','provider_source_corrections','provider_source_local_observations',
    'provider_quota_windows','provider_quota_runtime','provider_quota_observations','provider_request_charges','public_resource_states','public_resource_versions','public_change_log',
    'publication_receipts','publication_rebuild_checkpoints','api_clients','api_keys','api_client_scopes','api_client_championships','api_client_minute_usage','api_client_daily_usage'
  ] loop
    execute format('select count(*) from %I', table_name) into row_count;
    if row_count <> 0 then raise exception 'F4-4 empty-event contract violated: % contains % rows', table_name, row_count; end if;
  end loop;
end $$;
SQL
[[ "$(db_psql -Atqc 'select count(*) from championships')" -gt 0 ]]
[[ "$(db_psql -Atqc 'select count(*) from circuits')" -gt 0 ]]
[[ "$(db_psql -Atqc 'select count(*) from session_types')" -gt 0 ]]
[[ "$(db_psql -Atqc 'select count(*) from scheduler_configuration where singleton')" == 1 ]]
[[ "$(db_psql -Atqc "select count(*) from provider_instances where enabled or state not in ('draft','disabled')")" == 0 ]]
[[ "$(db_psql -Atqc "select count(*) from provider_championships where sync_state <> 'inactive' or is_primary")" == 0 ]]

API_PORT="$(free_port)"
[[ "${PG_PORT}" != "${API_PORT}" ]] || API_PORT="$(free_port)"
DATABASE_URL="postgresql://mse_f4@127.0.0.1:${PG_PORT}/${DB_NAME}" \
ADMIN_AUTH_SECRET='f4-empty-db-admin-auth-secret-000000000000' ADMIN_SESSION_SECRET='f4-empty-db-session-secret-00000000000000' \
ADMIN_WEB_ORIGIN="http://127.0.0.1:${API_PORT}" PREVIEW_API_ENABLED=false NODE_ENV=test \
API_PORT="${API_PORT}" API_HOST=127.0.0.1 APP_VERSION=f4-empty-db \
GIT_SHA=0000000000000000000000000000000000000000 BUILD_TIME=1970-01-01T00:00:00Z \
  "${ROOT}/node_modules/.bin/tsx" "${ROOT}/apps/api/src/server.ts" >"${TMP_ROOT}/api.log" 2>&1 &
API_PID=$!
ready=false
for _ in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${API_PORT}/health/ready" >"${TMP_ROOT}/ready.json"; then ready=true; break; fi
  kill -0 "${API_PID}" 2>/dev/null || { sed -n '1,120p' "${TMP_ROOT}/api.log" >&2; exit 1; }
  sleep 0.25
done
[[ "${ready}" == true ]]
node -e 'const v=JSON.parse(process.argv[1]);if(v.status!=="ok"||v.readiness!=="compatible")process.exit(1)' "$(<"${TMP_ROOT}/ready.json")"
curl --fail --silent "http://127.0.0.1:${API_PORT}/health" >"${TMP_ROOT}/health.json"
node -e 'const v=JSON.parse(process.argv[1]);if(v.status!=="ok"||v.checks?.database!==true)process.exit(1)' "$(<"${TMP_ROOT}/health.json")"
curl --fail --silent "http://127.0.0.1:${API_PORT}/api/v1/events" >"${TMP_ROOT}/events.json"
node -e 'const v=JSON.parse(process.argv[1]);if(!Array.isArray(v)||v.length!==0)process.exit(1)' "$(<"${TMP_ROOT}/events.json")"
echo "F4-4 isolated empty event database: PASS (${BACKEND}, schema ${EXPECTED_HEAD}, calendar [])."
