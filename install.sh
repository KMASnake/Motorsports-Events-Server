#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
cd "${PROJECT_ROOT}"








fix_configuration_ownership() {
  local target_user="${SUDO_USER:-${USER:-root}}"
  local target_group=""

  if id "${target_user}" >/dev/null 2>&1; then
    target_group="$(id -gn "${target_user}")"
    chown "${target_user}:${target_group}" "${PROJECT_ROOT}/.env"
    chmod 600 "${PROJECT_ROOT}/.env"
    echo "Configuration attribuée à ${target_user}:${target_group}."
  else
    chmod 600 "${PROJECT_ROOT}/.env"
  fi
}

prepare_postgres_permissions() {
  local data_dir="${PROJECT_ROOT}/data"
  local postgres_dir="${data_dir}/postgres"
  local expected_uid="70"
  local expected_gid="70"
  local identity=""

  mkdir -p "${postgres_dir}"

  # Le dossier parent doit être traversable par l’utilisateur du conteneur.
  chown root:root "${data_dir}"
  chmod 755 "${data_dir}"

  # Détection dynamique de l’UID/GID de postgres dans l’image.
  if command -v docker >/dev/null 2>&1; then
    identity="$(
      docker run --rm --entrypoint sh postgres:16-alpine \
        -c 'printf "%s:%s" "$(id -u postgres)" "$(id -g postgres)"' \
        2>/dev/null || true
    )"

    if [[ "${identity}" =~ ^[0-9]+:[0-9]+$ ]]; then
      expected_uid="${identity%%:*}"
      expected_gid="${identity##*:}"
    fi
  fi

  echo "Permissions PostgreSQL attendues : ${expected_uid}:${expected_gid}"

  chown -R "${expected_uid}:${expected_gid}" "${postgres_dir}"

  # PostgreSQL exige des permissions restrictives.
  find "${postgres_dir}" -type d -exec chmod 700 {} \;
  find "${postgres_dir}" -type f -exec chmod 600 {} \;
  chmod 700 "${postgres_dir}"

  local current_uid current_gid current_mode
  current_uid="$(stat -c '%u' "${postgres_dir}")"
  current_gid="$(stat -c '%g' "${postgres_dir}")"
  current_mode="$(stat -c '%a' "${postgres_dir}")"

  if [[ "${current_uid}" != "${expected_uid}" ||
        "${current_gid}" != "${expected_gid}" ||
        "${current_mode}" != "700" ]]; then
    echo "Échec de la préparation du volume PostgreSQL."
    echo "Actuel : ${current_uid}:${current_gid} mode ${current_mode}"
    echo "Attendu : ${expected_uid}:${expected_gid} mode 700"
    exit 1
  fi

  echo "Volume PostgreSQL prêt."
}

port_owner() {
  local port="$1"
  local result=""

  if command -v ss >/dev/null 2>&1; then
    result="$(ss -ltnp 2>/dev/null | awk -v p=":${port}" '$4 ~ p"$" {print; exit}')"
  fi

  if [[ -z "${result}" ]] && command -v lsof >/dev/null 2>&1; then
    result="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -n 1)"
  fi

  if [[ -z "${result}" ]] && command -v docker >/dev/null 2>&1; then
    result="$(
      docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null \
        | awk -v p="0.0.0.0:${port}->" '$0 ~ p {print; exit}'
    )"
  fi

  printf '%s' "${result}"
}

port_is_busy() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(:|\\])${port}$"
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  return 1
}

docker_container_using_port() {
  local port="$1"

  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null \
    | awk -v p1="0.0.0.0:${port}->" -v p2="[::]:${port}->" '
        index($0, p1) || index($0, p2) {print $1; exit}
      '
}

handle_port_conflict() {
  local port="$1"
  local owner
  local container_id

  if ! port_is_busy "${port}"; then
    return 0
  fi

  owner="$(port_owner "${port}")"
  container_id="$(docker_container_using_port "${port}" || true)"

  echo
  echo "Le port ${port} est déjà utilisé."
  if [[ -n "${owner}" ]]; then
    echo "Détail : ${owner}"
  fi
  echo

  if [[ -n "${container_id}" ]]; then
    echo "Un conteneur Docker utilise ce port."
    echo "1) Arrêter et supprimer ce conteneur"
    echo "2) Annuler l’installation"
    read -r -p "Choix [2] : " choice
    choice="${choice:-2}"

    case "${choice}" in
      1)
        echo "Arrêt du conteneur ${container_id}…"
        docker stop "${container_id}"
        docker rm "${container_id}"
        ;;
      *)
        echo "Installation annulée."
        exit 1
        ;;
    esac
  else
    echo "Un service système utilise ce port."
    echo "1) Tenter d’identifier puis arrêter nginx/apache2"
    echo "2) Annuler l’installation"
    read -r -p "Choix [2] : " choice
    choice="${choice:-2}"

    case "${choice}" in
      1)
        stopped=0

        if systemctl is-active --quiet nginx 2>/dev/null; then
          systemctl stop nginx
          systemctl disable nginx
          stopped=1
        fi

        if systemctl is-active --quiet apache2 2>/dev/null; then
          systemctl stop apache2
          systemctl disable apache2
          stopped=1
        fi

        if [[ "${stopped}" -eq 0 ]]; then
          echo "Aucun service nginx/apache2 actif n’a été trouvé."
          echo "Libérez manuellement le port ${port}, puis relancez l’installation."
          exit 1
        fi
        ;;
      *)
        echo "Installation annulée."
        exit 1
        ;;
    esac
  fi

  sleep 2

  if port_is_busy "${port}"; then
    echo "Le port ${port} est toujours occupé."
    echo "Libérez-le manuellement puis relancez l’installation."
    exit 1
  fi
}


echo "Motorsports Events Server 2.1.0"
echo "Détection automatique de l’environnement…"
echo

DETECTED="$(python3 "${PROJECT_ROOT}/scripts/detect-environment.py" --plain)"
SELECTED="${MOTORSPORTS_ENVIRONMENT:-${DETECTED}}"

if [[ "${SELECTED}" != "synology" && "${SELECTED}" != "vps" ]]; then
  echo "Environnement invalide : ${SELECTED}"
  exit 1
fi

echo "Environnement détecté : ${DETECTED}"
[[ -n "${MOTORSPORTS_ENVIRONMENT:-}" ]] && echo "Environnement forcé : ${SELECTED}"
echo

python3 "${PROJECT_ROOT}/scripts/detect-environment.py"
echo

if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
  python3 "${PROJECT_ROOT}/scripts/configure.py" \
    --environment "${SELECTED}" \
    --output "${PROJECT_ROOT}/.env"
fi

fix_configuration_ownership

mkdir -p "${PROJECT_ROOT}/data/postgres" \
         "${PROJECT_ROOT}/data/caddy" \
         "${PROJECT_ROOT}/data/caddy-config" \
         "${PROJECT_ROOT}/backups" \
         "${PROJECT_ROOT}/logs"

if [[ "${SELECTED}" == "vps" ]]; then
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Sur VPS, relancez avec : sudo ./install.sh"
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    if [[ -f /etc/os-release ]]; then
      source /etc/os-release
    fi
    apt-get update
    apt-get install -y ca-certificates curl gnupg ufw
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 443/udp
    ufw --force enable
  fi

  echo "Préparation du volume PostgreSQL…"
  prepare_postgres_permissions

  echo "Vérification des ports HTTP/HTTPS…"
  handle_port_conflict 80
  handle_port_conflict 443

  docker compose --profile vps build --pull
  docker compose --profile vps up -d
  API_DOMAIN="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" API_DOMAIN --env "${PROJECT_ROOT}/.env" --required)"
  python3 "${PROJECT_ROOT}/scripts/healthcheck.py" \
    --url "https://${API_DOMAIN}"
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Container Manager/Docker n’est pas disponible sur ce Synology."
    exit 1
  fi
  docker compose build --pull
  docker compose up -d
  NAS_IP="${NAS_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  NAS_IP="${NAS_IP:-127.0.0.1}"
  python3 "${PROJECT_ROOT}/scripts/healthcheck.py" \
    --url "http://${NAS_IP}:${API_BIND_PORT:-8088}"
fi

echo
read -r -p "Lancer la première synchronisation maintenant ? [O/n] " ANSWER
if [[ "${ANSWER,,}" != "n" && "${ANSWER,,}" != "non" ]]; then
  if [[ "${SELECTED}" == "vps" ]]; then
    API_DOMAIN="$(python3 "${PROJECT_ROOT}/scripts/env_get.py" API_DOMAIN --env "${PROJECT_ROOT}/.env" --required)"
    python3 "${PROJECT_ROOT}/scripts/first-sync.py" \
      --url "https://${API_DOMAIN}" \
      --env "${PROJECT_ROOT}/.env"
  else
    python3 "${PROJECT_ROOT}/scripts/first-sync.py" \
      --url "http://${NAS_IP}:${API_BIND_PORT:-8088}" \
      --env "${PROJECT_ROOT}/.env"
  fi
fi

echo
echo "Installation terminée."
if [[ "${SELECTED}" == "vps" ]]; then
  echo "API : https://${API_DOMAIN}"
  echo "Documentation : https://${API_DOMAIN}/docs"
  echo "Administration : https://${API_DOMAIN}/admin"
else
  echo "API : http://${NAS_IP}:${API_BIND_PORT:-8088}"
fi
