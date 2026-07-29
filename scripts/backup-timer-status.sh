#!/usr/bin/env bash
set -Eeuo pipefail

systemctl status motorsports-events-backup.timer --no-pager
systemctl list-timers motorsports-events-backup.timer --no-pager
