#!/usr/bin/env sh
set -eu

PROJECT_PATTERN="motorsports-events"
REMOVE_VOLUMES=0
REMOVE_IMAGES=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --volumes) REMOVE_VOLUMES=1 ;;
    --images) REMOVE_IMAGES=1 ;;
    --force) FORCE=1 ;;
  esac
done

confirm() {
  if [ "$FORCE" -eq 1 ]; then return 0; fi
  printf "%s [y/N] " "$1"
  read -r answer
  case "$answer" in y|Y|yes|YES|o|O|oui|OUI) return 0 ;; *) return 1 ;; esac
}

echo "=== Conteneurs ==="
ids="$(docker ps -aq --filter "name=$PROJECT_PATTERN" || true)"
if [ -n "$ids" ]; then
  # shellcheck disable=SC2086
  docker rm -f $ids
else
  echo "Aucun conteneur correspondant."
fi

echo "=== Réseaux ==="
docker network ls --format '{{.Name}}' | grep "$PROJECT_PATTERN" | while read -r network; do
  docker network rm "$network" || true
done

if [ "$REMOVE_VOLUMES" -eq 1 ] || confirm "Supprimer les volumes PostgreSQL de test ?"; then
  echo "=== Volumes ==="
  docker volume ls --format '{{.Name}}' | grep "$PROJECT_PATTERN" | while read -r volume; do
    docker volume rm "$volume" || true
  done
fi

if [ "$REMOVE_IMAGES" -eq 1 ] || confirm "Supprimer les images des anciennes versions ?"; then
  echo "=== Images ==="
  docker image ls --format '{{.Repository}} {{.ID}}' |
    grep "$PROJECT_PATTERN" |
    awk '{print $2}' |
    sort -u |
    while read -r image; do docker image rm -f "$image" || true; done
fi

echo "=== Espace Docker ==="
docker system df || true
echo "Nettoyage terminé."
