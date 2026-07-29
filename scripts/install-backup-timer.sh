#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Exécutez ce script avec sudo."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd est requis pour installer le timer automatique."
  exit 1
fi

SERVICE_FILE="/etc/systemd/system/motorsports-events-backup.service"
TIMER_FILE="/etc/systemd/system/motorsports-events-backup.timer"

{
  echo "[Unit]"
  echo "Description=Sauvegarde Motorsports Events Server"
  echo "After=docker.service"
  echo
  echo "[Service]"
  echo "Type=oneshot"
  printf 'WorkingDirectory=%s\n' "${PROJECT_ROOT}"
  printf 'ExecStart=%s/scripts/backup.sh\n' "${PROJECT_ROOT}"
} > "${SERVICE_FILE}"

{
  echo "[Unit]"
  echo "Description=Sauvegarde quotidienne Motorsports Events Server"
  echo
  echo "[Timer]"
  echo "OnCalendar=*-*-* 03:15:00"
  echo "RandomizedDelaySec=15m"
  echo "Persistent=true"
  echo
  echo "[Install]"
  echo "WantedBy=timers.target"
} > "${TIMER_FILE}"

chmod 644 "${SERVICE_FILE}" "${TIMER_FILE}"
systemctl daemon-reload
systemctl enable --now motorsports-events-backup.timer
echo "Timer installé : prochaine exécution"
systemctl list-timers motorsports-events-backup.timer --no-pager
