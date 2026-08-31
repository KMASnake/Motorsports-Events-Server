#!/usr/bin/env bash
set -Eeuo pipefail

fail(){ printf 'F3 Phase 2 refused: %s\n' "$*" >&2; exit 1; }
[[ ${1:-} == --execute ]] || fail 'explicit --execute is required after separate maintainer VPS authorization'
[[ ${F3_PHASE2_EXECUTION_AUTHORIZED:-} == YES ]] || fail 'F3_PHASE2_EXECUTION_AUTHORIZED=YES is required'
shift
[[ $# -eq 12 ]] || fail 'usage: --execute --baseline FILE --n-api REF --n-web REF --n-plus-one-api REF --n-plus-one-web REF --evidence-dir DIR'
while [[ $# -gt 0 ]];do case "$1" in
  --baseline) baseline=$2;; --n-api) n_api=$2;; --n-web) n_web=$2;;
  --n-plus-one-api) n1_api=$2;; --n-plus-one-web) n1_web=$2;;
  --evidence-dir) evidence_dir=$2;; *) fail "unknown argument: $1";;
esac;shift 2;done
for name in baseline n_api n_web n1_api n1_web evidence_dir;do [[ -n ${!name:-} ]]||fail "$name is required";done
readonly immutable='^.+@sha256:[0-9a-f]{64}$'
for ref in "$n_api" "$n_web" "$n1_api" "$n1_web";do [[ $ref =~ $immutable ]]||fail "mutable image reference refused: $ref";done
[[ -f $baseline ]]||fail 'prospective baseline artifact is absent'
[[ -f .env.preprod ]]||fail '.env.preprod is absent'
[[ $(docker context show) == default ]]||fail 'Docker context is not default'
[[ $(docker context inspect default --format '{{(index .Endpoints "docker").Host}}') == unix:///var/run/docker.sock ]]||fail 'Docker endpoint is not the local Unix socket'

readonly -a compose=(docker compose --env-file .env.preprod -p mse-preprod -f docker-compose.yml -f docker-compose.preprod.yml)
readonly workdir="$(mktemp -d /tmp/lot57pf3-phase2.XXXXXX)"
readonly n_override="$workdir/n.yml" n1_override="$workdir/n1.yml"
readonly cert_runner=mse-f3-certification-runner cert_network=mse-f3-certification-internal
readonly cursor_probe="$(pwd)/scripts/validate-lot57pf3-phase2-cursor.mjs"
current_state='preflight-not-complete';restore_db='';success=false
cleanup_resources(){
  local failed=0
  if [[ -n $restore_db ]];then
    [[ $restore_db =~ ^f3_restore_[0-9a-f]{16}$ ]]||failed=1
    "${compose[@]}" exec -T postgres sh -eu -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$restore_db" >/dev/null 2>&1||failed=1
    if "${compose[@]}" exec -T postgres sh -eu -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -lqt'|cut -d '|' -f1|tr -d ' '|grep -Fxq -- "$restore_db";then failed=1;fi
  fi
  docker rm -f "$cert_runner" >/dev/null 2>&1||failed=1
  if docker inspect "$cert_runner" >/dev/null 2>&1;then failed=1;fi
  if [[ -n $(docker ps -aq --filter label=com.mse.certification=lot57pf3) ]];then failed=1;fi
  return "$failed"
}
finish(){
  local status=$? cleanup_status=0
  trap - EXIT INT TERM
  cleanup_resources||cleanup_status=$?
  if [[ $status -eq 0 && $cleanup_status -eq 0 && $success == true ]];then
    node -e "const fs=require('fs'),p=process.argv[1],v=JSON.parse(fs.readFileSync(p));v.cleanup_verified=true;fs.writeFileSync(p,JSON.stringify(v,null,2)+'\\n',{mode:0o600});" "$workdir/phase2-raw.json"
    mkdir -p "$evidence_dir"
    if ! node scripts/validate-lot57pf3-phase2-evidence.mjs "$workdir/phase2-raw.json" "$evidence_dir/lot57pf3-phase2-evidence.json";then status=1;fi
  else
    status=1
    printf 'F3 Phase 2 cleanup failed or certification incomplete; no PASS evidence was written.\n' >&2
  fi
  rm -rf -- "$workdir"
  if [[ $status -ne 0 ]];then printf 'F3 Phase 2 stopped fail-closed; SAFE_RUNTIME_LEFT=%s; worker remains stopped; no DOWN migration, DB reset, restore, Compose down or automatic release rollback was performed.\n' "$current_state" >&2;fi
  exit "$status"
}
trap finish EXIT INT TERM

write_override(){ local path=$1 api=$2 web=$3;cat >"$path" <<EOF
services:
  api:
    image: $api
    build: !reset null
  worker:
    image: $api
    build: !reset null
  web:
    image: $web
    build: !reset null
EOF
}
write_override "$n_override" "$n_api" "$n_web"
write_override "$n1_override" "$n1_api" "$n1_web"

database_url(){ docker inspect "$("${compose[@]}" ps -q api)" --format '{{range .Config.Env}}{{println .}}{{end}}'|sed -n 's/^DATABASE_URL=//p'|head -n1; }
recreate_cert_runner(){
  local image=$1 db_url;db_url=$(database_url);[[ -n $db_url ]]||fail 'runtime DATABASE_URL is not inspectable'
  docker rm -f "$cert_runner" >/dev/null 2>&1||true
  docker run -d --name "$cert_runner" --network "$cert_network" --read-only --cap-drop ALL --security-opt no-new-privileges \
    --label com.mse.certification=lot57pf3 --label com.mse.certification.target=preproduction \
    -e DATABASE_URL="$db_url" -v "$cursor_probe:/certification/cursor.mjs:ro" "$image" node -e 'setInterval(()=>{},2147483647)' >/dev/null
}
snapshot(){
  local release=$1 output=$2
  node scripts/capture-lot57pf3-runtime-snapshot.mjs --n-api-image "$n_api" --n-web-image "$n_web" \
    --n-plus-one-api-image "$n1_api" --n-plus-one-web-image "$n1_web" --runtime-release "$release" --output "$output"
  node scripts/validate-lot57pf3-preflight.mjs "$output" "$baseline" >/dev/null
}
assert_worker_stopped(){
  local id;id=$("${compose[@]}" ps -aq worker);[[ -n $id ]]||fail 'stopped worker container is absent'
  [[ $(docker inspect "$id" --format '{{.State.Running}}') == false ]]||fail 'worker started'
}
transition(){
  local label=$1 override=$2 api=$3 runtime_release=$4
  "${compose[@]}" -f "$override" create --no-build --no-deps --force-recreate worker >/dev/null
  assert_worker_stopped
  "${compose[@]}" -f "$override" up -d --no-build --no-deps api web
  current_state=$label
  recreate_cert_runner "$api"
  snapshot "$runtime_release" "$workdir/$label-snapshot.json"
}
cursor_capture(){ docker exec -e F3_CURSOR_MODE=capture "$cert_runner" node /certification/cursor.mjs; }
cursor_verify(){ docker exec -e F3_CURSOR_MODE=verify -e F3_CURSOR_INPUT="$1" "$cert_runner" node /certification/cursor.mjs >/dev/null; }
http_checks(){
  curl --fail --silent --show-error https://preprod.motorsports-events.fr/health >/dev/null
  curl --fail --silent --show-error https://preprod.motorsports-events.fr/health/live >/dev/null
  curl --fail --silent --show-error https://preprod.motorsports-events.fr/health/ready >/dev/null
  [[ $(curl --silent --output /dev/null --write-out '%{http_code}' https://preprod.motorsports-events.fr/metrics) == 404 ]]||fail 'public metrics exposure detected'
  curl --fail --silent --show-error -H 'Origin: https://preprod.motorsports-events.fr' -X OPTIONS https://preprod.motorsports-events.fr/api/v1/events -D "$workdir/cors-allowed" -o /dev/null
  grep -qi '^access-control-allow-origin: https://preprod.motorsports-events.fr' "$workdir/cors-allowed"||fail 'allowed CORS origin missing'
  curl --silent --show-error -H 'Origin: https://evil.example' -X OPTIONS https://preprod.motorsports-events.fr/api/v1/events -D "$workdir/cors-denied" -o /dev/null
  ! grep -qi '^access-control-allow-origin:' "$workdir/cors-denied"||fail 'foreign CORS origin granted'
  "${compose[@]}" exec -T prometheus wget -qO- http://api:3001/metrics | grep -q '^motorsports_'||fail 'Prometheus cannot scrape API metrics'
}
db_anchor(){
  local database=${1:-} output=$2
  "${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_USER"')" -d "$database" -Atc "select json_build_object(
    'migration_head',(select version from schema_migrations order by applied_at desc,version desc limit 1),
    'change_sequence',coalesce((select max(sequence) from public_change_log),0),
    'event_revision',coalesce((select max(revision) from public_resource_states where resource_type='event'),0),
    'meeting_revision',coalesce((select max(revision) from public_resource_states where resource_type='meeting'),0),
    'normalization_checkpoint_count',(select count(*) from normalization_checkpoints),
    'uuid_anchor',(select md5(coalesce(string_agg(resource_type||':'||resource_id::text,',' order by resource_type,resource_id::text),'')) from public_resource_states),
    'relationship_anchor',(select md5(coalesce(string_agg(meeting_id::text||':'||event_id::text,',' order by meeting_id,event_id),'')) from meeting_events),
    'orphan_relationships',(select count(*) from meeting_events me left join meetings m on m.id=me.meeting_id left join events e on e.id=me.event_id where m.id is null or e.id is null)
  )::text" >"$output"
  [[ $(node -e "const v=JSON.parse(require('fs').readFileSync(process.argv[1]));process.stdout.write(String(v.orphan_relationships))" "$output") == 0 ]]||fail 'relationship integrity failed'
}
assert_baseline_continuity(){ node -e "const fs=require('fs'),baseline=JSON.parse(fs.readFileSync(process.argv[1])),current=JSON.parse(fs.readFileSync(process.argv[2]));for(const [field,key] of [['change_sequence','change_sequence'],['event_revision','event_revision'],['meeting_revision','meeting_revision'],['normalization_checkpoint_count','normalization_checkpoint_count']])if(Number(current[key])<Number(baseline.continuity[field]))throw Error('baseline continuity regressed: '+field);" "$baseline" "$1"||fail 'database baseline continuity prerequisite failed'; }
compare_continuity(){ node -e "const fs=require('fs'),before=JSON.parse(fs.readFileSync(process.argv[1])),after=JSON.parse(fs.readFileSync(process.argv[2]));for(const key of ['uuid_anchor','relationship_anchor'])if(before[key]!==after[key])throw Error(key+' changed');for(const key of ['change_sequence','event_revision','meeting_revision'])if(Number(after[key])<Number(before[key]))throw Error(key+' regressed');" "$1" "$2"||fail "database continuity failed between $1 and $2"; }
same_migration_head(){ node -e "const fs=require('fs'),a=JSON.parse(fs.readFileSync(process.argv[1])),b=JSON.parse(fs.readFileSync(process.argv[2]));if(!a.migration_head||a.migration_head!==b.migration_head)throw Error('migration head changed');" "$1" "$2"||fail "migration head mismatch between $1 and $2"; }
record_state(){
  local label=$1 runtime_release=$2 cursor_before_valid=$3 cursor_after_valid=$4
  node -e "const fs=require('fs'),label=process.argv[1],runtime_release=process.argv[2],before=process.argv[3]==='true',after=process.argv[4]==='true',root=process.argv[5];const state={label,runtime_release,snapshot:JSON.parse(fs.readFileSync(root+'/'+label+'-snapshot.json')),database:JSON.parse(fs.readFileSync(root+'/'+label+'-db.json')),checks:{health:true,health_live:true,health_ready:true,tls:true,cors_allowed_origin:true,cors_foreign_denied:true,metrics:true},cursor_before_valid:before,cursor_after_valid:after};fs.writeFileSync(root+'/'+label+'-state.json',JSON.stringify(state,null,2)+'\\n',{mode:0o600});" "$label" "$runtime_release" "$cursor_before_valid" "$cursor_after_valid" "$workdir"
}

# Pre-mutation proof: exact retained N, every safety guard, DB anchors and a disposable restore.
recreate_cert_runner "$n_api"
snapshot n "$workdir/n-pre-migration-snapshot.json"
current_state='exact-n-preflight'
assert_worker_stopped
http_checks
db_anchor "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')" "$workdir/n-pre-migration-db.json"
assert_baseline_continuity "$workdir/n-pre-migration-db.json"
cursor_before=$(cursor_capture|node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).cursor))")
record_state n-pre-migration n true false
backup="$workdir/pre-transition.dump"
"${compose[@]}" exec -T postgres sh -eu -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$backup"
pg_restore --list "$backup" >/dev/null
restore_db="f3_restore_$(od -An -N8 -tx1 /dev/urandom|tr -d ' \n')"
"${compose[@]}" exec -T postgres sh -eu -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"
"${compose[@]}" exec -T postgres sh -eu -c 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" <"$backup"
db_anchor "$restore_db" "$workdir/restored-db.json"
cmp -s "$workdir/n-pre-migration-db.json" "$workdir/restored-db.json"||fail 'disposable restore integrity differs from baseline'

# N -> N+1: forward migrations only, then exact immutable API+Web with --no-build.
"${compose[@]}" run --rm -T migrate
current_state='n-post-forward-migration'
snapshot n "$workdir/n-post-forward-migration-snapshot.json"
http_checks;db_anchor "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')" "$workdir/n-post-forward-migration-db.json"
compare_continuity "$workdir/n-pre-migration-db.json" "$workdir/n-post-forward-migration-db.json"
cursor_verify "$cursor_before"
record_state n-post-forward-migration n true false
transition n-plus-one "$n1_override" "$n1_api" n-plus-one
http_checks;db_anchor "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')" "$workdir/n-plus-one-db.json"
compare_continuity "$workdir/n-post-forward-migration-db.json" "$workdir/n-plus-one-db.json"
cursor_verify "$cursor_before";cursor_after=$(cursor_capture|node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).cursor))")
record_state n-plus-one n_plus_1 true true

# N+1 -> N rollback: application images only; never DOWN/reset/restore.
transition rollback-n "$n_override" "$n_api" n
http_checks;db_anchor "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')" "$workdir/rollback-n-db.json"
compare_continuity "$workdir/n-plus-one-db.json" "$workdir/rollback-n-db.json";same_migration_head "$workdir/n-plus-one-db.json" "$workdir/rollback-n-db.json"
cursor_verify "$cursor_before";cursor_verify "$cursor_after"
record_state rollback-n n true true

# N -> final N+1: exact immutable images, final runtime state.
transition final-n-plus-one "$n1_override" "$n1_api" n-plus-one
http_checks;db_anchor "$("${compose[@]}" exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')" "$workdir/final-n-plus-one-db.json"
compare_continuity "$workdir/rollback-n-db.json" "$workdir/final-n-plus-one-db.json";same_migration_head "$workdir/n-plus-one-db.json" "$workdir/final-n-plus-one-db.json"
cursor_verify "$cursor_before";cursor_verify "$cursor_after"
record_state final-n-plus-one n_plus_1 true true

node -e "const fs=require('fs'),root=process.argv[1],baseline=JSON.parse(fs.readFileSync(process.argv[2])),names=['n-pre-migration','n-post-forward-migration','n-plus-one','rollback-n','final-n-plus-one'];const states=Object.fromEntries(names.map(name=>[name,JSON.parse(fs.readFileSync(root+'/'+name+'-state.json'))]));const raw={schema:'lot57pf3-phase2-raw-v1',sequence:names,prospective_baseline:baseline,states,backup_restore:{backup_verified:true,disposable_restore_db:true,restore_integrity_match:true},provider_calls:0,provider_credits:0,worker_started:false,cleanup_verified:false};fs.writeFileSync(root+'/phase2-raw.json',JSON.stringify(raw,null,2)+'\\n',{mode:0o600});" "$workdir" "$baseline"
printf '%s\n' 'PP-T38/PP-178 Phase 2 sequence reached final N+1; final evidence remains conditional on verified cleanup and strict evidence validation.'
success=true
