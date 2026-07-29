import os
from pathlib import Path
import stat
import subprocess


ROOT = Path(__file__).resolve().parent.parent


def _write_fake_docker(path: Path) -> None:
    path.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
if [[ "${args}" == *" pg_dump "* ]]; then
  printf '%s\\n' 'CREATE TABLE events (id integer);'
elif [[ "${args}" == *" -Atqc "* ]]; then
  printf '%s\\n' '7'
elif [[ "${args}" == *" psql "* ]]; then
  cat >/dev/null
fi
""",
        encoding="utf-8",
    )
    path.chmod(0o755)


def test_backup_is_atomic_verified_and_private(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_docker(bin_dir / "docker")
    env_file = tmp_path / ".env"
    env_file.write_text(
        "POSTGRES_USER=tester\nPOSTGRES_DB=motorsports\n",
        encoding="utf-8",
    )
    backup_dir = tmp_path / "backups"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "MOTORSPORTS_ENV_FILE": str(env_file),
        "MOTORSPORTS_BACKUP_DIR": str(backup_dir),
        "MOTORSPORTS_ENVIRONMENT": "synology",
    }

    result = subprocess.run(
        ["bash", str(ROOT / "scripts" / "backup.sh")],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    backups = list(backup_dir.glob("motorsports-events-*.sql.gz"))
    assert len(backups) == 1
    assert not list(backup_dir.glob("*.partial"))
    assert stat.S_IMODE(backups[0].stat().st_mode) == 0o600
    assert "Sauvegarde vérifiée par restauration temporaire" in result.stdout


def test_timer_is_persistent_and_runs_daily():
    source = (
        ROOT / "scripts" / "install-backup-timer.sh"
    ).read_text(encoding="utf-8")

    assert "OnCalendar=*-*-* 03:15:00" in source
    assert "RandomizedDelaySec=15m" in source
    assert "Persistent=true" in source
    assert "systemctl enable --now" in source


def test_restore_validates_before_stopping_services():
    source = (ROOT / "scripts" / "restore.sh").read_text(encoding="utf-8")

    assert source.index("verify-backup.sh") < source.index(
        "compose stop api scheduler"
    )
    assert "ON_ERROR_STOP=1" in source
    assert "trap restart_services EXIT" in source
