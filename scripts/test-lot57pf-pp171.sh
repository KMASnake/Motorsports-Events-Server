#!/usr/bin/env bash
set -Eeuo pipefail

readonly compose_file="docker-compose.lot57pf-pp171.yml"
readonly project_prefix="mse-lot57pf-pp171-"
readonly suffix="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
readonly project="${project_prefix}${suffix}"
readonly database_password="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
readonly raw_evidence="$(mktemp /tmp/lot57pf-pp171-evidence.XXXXXX.json)"
readonly git_sha="$(git rev-parse HEAD)"
readonly version="$(node -p "require('./package.json').version")"
readonly evidence_dir="dist/certification"
readonly evidence_file="${evidence_dir}/lot57pf-pp171-${git_sha}-${suffix}.json"
readonly -a compose=(docker compose --env-file /dev/null -f "$compose_file" -p "$project")
cleanup_verified=false
docker_touched=false

fail(){ printf 'PP-171 certification refused: %s\n' "$*" >&2; exit 1; }

cleanup(){
  local down_status=0 inspect_status=0 residual
  if [[ $docker_touched != true ]];then cleanup_verified=true;return 0;fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || down_status=$?
  residual="$(
    {
      docker ps -aq --filter "label=com.docker.compose.project=$project"
      docker network ls -q --filter "label=com.docker.compose.project=$project"
      docker volume ls -q --filter "label=com.docker.compose.project=$project"
    } | sed '/^$/d'
  )" || inspect_status=$?
  if [[ $down_status -ne 0 || $inspect_status -ne 0 || -n $residual ]];then
    printf 'PP-171 cleanup failed for isolated project %s\n' "$project" >&2
    return 1
  fi
  cleanup_verified=true
}

finish(){
  local status=$?
  trap - EXIT INT TERM
  if ! cleanup;then status=1;fi
  if [[ $status -eq 0 && $cleanup_verified == true ]];then
    mkdir -p "$evidence_dir"
    if ! node scripts/validate-lot57pf-pp171.mjs finalize "$raw_evidence" "$evidence_file" "$git_sha" "$version";then status=1;fi
  fi
  rm -f "$raw_evidence"
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT TERM

[[ -z ${LOT57PF_PP171_PROJECT:-} ]] || fail 'LOT57PF_PP171_PROJECT is forbidden; the project name is generated internally'
[[ -z ${COMPOSE_FILE:-} ]] || fail 'COMPOSE_FILE override is forbidden'
[[ -z ${COMPOSE_PROJECT_NAME:-} ]] || fail 'COMPOSE_PROJECT_NAME override is forbidden'
[[ -z ${DOCKER_HOST:-} ]] || fail 'DOCKER_HOST override is forbidden'
[[ -z ${DOCKER_CONTEXT:-} ]] || fail 'DOCKER_CONTEXT override is forbidden'
[[ -z ${DATABASE_URL:-} ]] || fail 'operator DATABASE_URL is forbidden'
[[ $project =~ ^mse-lot57pf-pp171-[0-9a-f]{24}$ ]] || fail 'generated Compose project name is invalid'
[[ $project != *preprod* && $project != *staging* && $project != *production* ]] || fail 'unsafe Compose project name'
[[ -f $compose_file ]] || fail "dedicated Compose file is missing: $compose_file"

readonly docker_context="$(docker context show)"
[[ $docker_context == default ]] || fail "Docker context must be default, got: $docker_context"
readonly docker_endpoint="$(docker context inspect "$docker_context" --format '{{(index .Endpoints "docker").Host}}')"
[[ $docker_endpoint == unix:///var/run/docker.sock ]] || fail "unexpected Docker endpoint: $docker_endpoint"

export PP171_DATABASE_PASSWORD="$database_password"
export PP171_GIT_SHA="$git_sha"
export PP171_VERSION="$version"

docker_touched=true
"${compose[@]}" build certification
"${compose[@]}" up -d --wait postgres
"${compose[@]}" run --rm -T migrate
"${compose[@]}" run --rm -T --no-deps certification >"$raw_evidence"
