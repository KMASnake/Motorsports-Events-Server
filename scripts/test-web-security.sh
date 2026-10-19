#!/bin/sh
set -eu

PROJECT="${WEB_SECURITY_PROJECT:-mse-web-security}"
PORT="${WEB_SECURITY_PORT:-3780}"
API_ORIGIN="${WEB_SECURITY_API_ORIGIN:-}"
IMAGE="${PROJECT}:test"
CONTAINER="${PROJECT}-nginx"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

docker build --build-arg "VITE_API_URL=$API_ORIGIN" -f apps/web/Dockerfile -t "$IMAGE" . >/dev/null
docker run -d --name "$CONTAINER" -p "127.0.0.1:$PORT:3000" "$IMAGE" >/dev/null

attempt=0
until curl -fsS "http://127.0.0.1:$PORT/" >/dev/null; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 30 ] || { docker logs "$CONTAINER"; exit 1; }
  sleep 1
done

headers="$(curl -fsSI "http://127.0.0.1:$PORT/")"
require_header() {
  printf '%s\n' "$headers" | grep -Eiq "^$1:[[:space:]]*$2" || {
    printf 'Header absent ou invalide: %s\n%s\n' "$1" "$headers" >&2; exit 1;
  }
}
require_header 'X-Content-Type-Options' 'nosniff'
require_header 'Referrer-Policy' 'no-referrer'
require_header 'X-Frame-Options' 'DENY'
require_header 'Permissions-Policy' 'camera=\(\), microphone=\(\), geolocation=\(\)'
if [ -n "$API_ORIGIN" ]; then
  require_header 'Content-Security-Policy' ".*connect-src 'self' $API_ORIGIN.*"
else
  require_header 'Content-Security-Policy' ".*connect-src 'self'[[:space:]]*;.*"
fi
printf '%s\n' "$headers" | grep -Fq 'unsafe-eval' && { echo 'unsafe-eval interdit' >&2; exit 1; }
printf '%s\n' "$headers" | grep -Eiq '^Strict-Transport-Security:' && { echo 'HSTS appartient au reverse proxy TLS' >&2; exit 1; }

docker exec "$CONTAINER" sh -c \
  "! grep -R -E 'http://(127\\.0\\.0\\.1:[0-9]+|localhost:3001)' /usr/share/nginx/html"

echo "Headers Nginx Web et CSP réelle : OK"
