#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "Validation de Motorsports Events Server"

python3 "${ROOT}/scripts/validate-python.py"
python3 -m unittest discover -s "${ROOT}/tests" -p 'test_*.py' -v

find "${ROOT}" -type f -name '*.sh' -print0 |
  xargs -0 -r bash -n

for required in \
  VERSION \
  docker-compose.yml \
  Caddyfile \
  install.sh \
  server/Dockerfile \
  server/app/main.py
do
  if [[ ! -e "${ROOT}/${required}" ]]; then
    echo "Élément obligatoire absent : ${required}"
    exit 1
  fi
done

if find "${ROOT}" -type f \( -name '.env' -o -path '*/data/*' \) | grep -q .; then
  echo "Un secret ou une donnée d’exécution est présent dans le dépôt."
  exit 1
fi

echo "Validation terminée."
