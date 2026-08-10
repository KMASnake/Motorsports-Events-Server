#!/bin/sh
set -eu

MIGRATIONS_DIR=${MIGRATIONS_DIR:-/migrations}
ACTION=${1:-up}

psql_base() {
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

psql_base -c 'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())' >/dev/null

if [ "$ACTION" = "down" ]; then
  version=${2:?Usage: migrate.sh down VERSION}
  file="$MIGRATIONS_DIR/$version.down.sql"
  [ -f "$file" ] || { echo "Migration rollback missing: $file" >&2; exit 1; }
  psql_base -1 -f "$file"
  exit 0
fi

[ "$ACTION" = "up" ] || { echo "Unknown migration action: $ACTION" >&2; exit 1; }

for file in "$MIGRATIONS_DIR"/*.up.sql; do
  [ -f "$file" ] || continue
  version=$(basename "$file" .up.sql)
  applied=$(psql_base -Atqc "select 1 from schema_migrations where version = '$version'")
  if [ "$applied" = "1" ]; then
    echo "Already applied: $version"
    continue
  fi
  echo "Applying: $version"
  psql_base -1 -f "$file"
done
