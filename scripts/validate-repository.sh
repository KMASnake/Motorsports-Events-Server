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
  docker-compose.test.yml \
  Caddyfile \
  install.sh \
  server/Dockerfile \
  server/alembic.ini \
  server/alembic/versions/0001_initial_schema.py \
  server/app/main.py \
  tests/Dockerfile \
  tests/fixtures/indycar_events.json
do
  if [[ ! -e "${ROOT}/${required}" ]]; then
    echo "Élément obligatoire absent : ${required}"
    exit 1
  fi
done

runtime_data_found=false
if [[ -d "${ROOT}/data" ]] &&
  find "${ROOT}/data" -type f -print -quit | grep -q .
then
  runtime_data_found=true
fi

if find "${ROOT}" -type f -name '.env' \
    -not -path "${ROOT}/.git/*" -print -quit | grep -q . ||
  [[ "${runtime_data_found}" == true ]]
then
  echo "Un secret ou une donnée d’exécution est présent dans le dépôt."
  exit 1
fi

echo "Validation terminée."
