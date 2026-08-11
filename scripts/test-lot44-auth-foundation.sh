#!/bin/sh
set -eu

PROJECT=${LOT44_PROJECT:-mse-lot44-auth-foundation}
POSTGRES_PORT=${LOT44_POSTGRES_PORT:-55464}
PASSWORD=${LOT44_POSTGRES_PASSWORD:-lot44-foundation-test}

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PORT
export POSTGRES_PASSWORD="$PASSWORD"
export DATABASE_URL="postgresql://mse:$PASSWORD@postgres:5432/motorsports_events"

cleanup() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sql() {
  docker compose exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U mse -d motorsports_events -Atqc "$1"
}

rollback() {
  docker compose run --rm migrate sh /migrations/migrate.sh down 0006_admin_console_authentication
}

echo "Création de la base isolée Lot 4.4 étape 1..."
cleanup
docker compose up -d --wait postgres >/dev/null
docker compose run --rm migrate >/dev/null

[ "$(sql "select count(*) from schema_migrations where version='0006_admin_console_authentication'")" = "1" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('admin_accounts','admin_login_guard','admin_sessions')")" = "3" ]
[ "$(sql "select count(*) from admin_accounts")" = "0" ]
[ "$(sql "select count(*) from admin_login_guard")" = "0" ]
echo "Migration 0006 sans création implicite de compte : OK"

docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0006_admin_console_authentication'")" = "1" ]
echo "Seconde montée idempotente : OK"

docker compose build api >/dev/null
printf '%s\n' 'correct horse battery staple' | docker compose run --rm -T api \
  node apps/api/dist/cli/admin.js create --username Admin --password-stdin >/dev/null
[ "$(sql "select username || ':' || username_normalized from admin_accounts")" = "Admin:admin" ]
[ "$(sql "select password_hash like '\$argon2id\$v=19\$m=65536,t=3,p=1\$%' from admin_accounts")" = "t" ]
[ "$(sql "select count(*) from admin_login_guard where failed_attempts=0 and window_started_at is null and blocked_until is null")" = "1" ]
if sql "select password_hash from admin_accounts" | grep -F 'correct horse battery staple' >/dev/null; then
  echo "Échec : mot de passe retrouvé en clair" >&2
  exit 1
fi
echo "Bootstrap singleton avec hash Argon2id : OK"

if printf '%s\n' 'another sufficiently long password' | docker compose run --rm -T api \
  node apps/api/dist/cli/admin.js create --username Other --password-stdin >/dev/null 2>&1; then
  echo "Échec : un second compte administrateur a été accepté" >&2
  exit 1
fi
echo "Second compte refusé : OK"

old_hash=$(sql "select password_hash from admin_accounts")
account_id=$(sql "select id from admin_accounts")
sql "insert into admin_sessions(id,admin_account_id,token_hash,created_at,last_seen_at,idle_expires_at,absolute_expires_at)
     values('00000000-0000-4000-8000-000000000001','$account_id',decode(repeat('ab',32),'hex'),now(),now(),now()+interval '1 hour',now()+interval '8 hours')"
printf '%s\n' 'new correct horse battery staple' | docker compose run --rm -T api \
  node apps/api/dist/cli/admin.js reset-password --username admin --password-stdin >/dev/null
new_hash=$(sql "select password_hash from admin_accounts")
[ "$old_hash" != "$new_hash" ]
[ "$(sql "select count(*) from admin_sessions where revoked_at is not null")" = "1" ]
echo "Récupération par reset et révocation des sessions : OK"

if rollback >/dev/null 2>&1; then
  echo "Échec : rollback accepté malgré le compte" >&2
  exit 1
fi
echo "Rollback protégé en présence de données : OK"

sql "delete from admin_accounts; delete from admin_login_guard"
rollback >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0006_admin_console_authentication'")" = "0" ]
[ "$(sql "select count(*) from information_schema.tables where table_schema='public' and table_name in ('admin_accounts','admin_login_guard','admin_sessions')")" = "0" ]
docker compose run --rm migrate >/dev/null
[ "$(sql "select count(*) from schema_migrations where version='0006_admin_console_authentication'")" = "1" ]
echo "Rollback explicite et réapplication : OK"
echo "Tests Lot 4.4 étape 1 : OK"
