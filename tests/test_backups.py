import os
from pathlib import Path
import stat
import subprocess
import shutil


ROOT = Path(__file__).resolve().parent.parent


def _write_fake_docker(path: Path) -> None:
    path.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
[[ -n "${FAKE_DOCKER_LOG:-}" ]] && printf '%s\\n' "${args}" >> "${FAKE_DOCKER_LOG}"
if [[ "${args}" == *" pg_dump "* ]]; then
  printf '%s\\n' 'CREATE TABLE events (id integer);'
elif [[ "${args}" == *" createdb "* && "${FAKE_DOCKER_FAIL_CREATEDB:-false}" == "true" ]]; then
  exit 17
elif [[ "${args}" == *" -Atqc "* ]]; then
  printf '%s\\n' '7'
elif [[ "${args}" == *" psql "* ]]; then
  cat >/dev/null
  if [[ "${FAKE_DOCKER_FAIL_PSQL:-false}" == "true" ]]; then
    exit 19
  fi
fi
""",
        encoding="utf-8",
    )
    path.chmod(0o755)


def test_backup_is_atomic_verified_and_private(tmp_path):
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    for name in ("backup.sh", "verify-backup.sh", "lib.sh", "env_get.py"):
        shutil.copy2(ROOT / "scripts" / name, scripts / name)
    (repository / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / "docker-compose.preprod.yml").write_text("services: {}\n", encoding="utf-8")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_docker(bin_dir / "docker")
    env_file = repository / ".env.preprod"
    env_file.write_text(
        "POSTGRES_USER=tester\nPOSTGRES_DB=motorsports\n",
        encoding="utf-8",
    )
    backup_dir = tmp_path / "backups"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "MOTORSPORTS_BACKUP_DIR": str(backup_dir),
    }

    result = subprocess.run(
        ["bash", str(scripts / "backup.sh")],
        cwd=repository,
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


def test_restore_is_disposable_verification_only():
    source = (ROOT / "scripts" / "restore.sh").read_text(encoding="utf-8")

    assert "verify-backup.sh" in source
    assert "base jetable" in source
    assert "dropdb" not in source
    assert "compose stop" not in source
    assert "compose start" not in source
    assert "scheduler" not in source
    assert "worker" not in source


def test_preprod_operations_are_explicit_and_worker_safe():
    library = (ROOT / "scripts" / "lib.sh").read_text(encoding="utf-8")
    update = (ROOT / "scripts" / "update.sh").read_text(encoding="utf-8")
    backup = (ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    verify = (ROOT / "scripts" / "verify-backup.sh").read_text(encoding="utf-8")

    for token in (
        '--env-file "${PREPROD_ENV_FILE}"',
        "-p mse-preprod",
        '-f "${COMPOSE_FILE}"',
        '-f "${PREPROD_COMPOSE_FILE}"',
    ):
        assert token in library
    assert "INHERITED_COMPOSE_FILE" in library
    assert "COMPOSE_PROJECT_NAME" in library
    assert "require_preprod_context" in library
    assert "preprod_compose exec -T postgres pg_dump" in backup
    assert "preprod_compose exec -T postgres" in verify
    assert " exec -T db " not in backup + verify
    assert "docker image prune" not in update
    assert "preprod_compose up -d --wait postgres" in update
    assert "preprod_compose up -d --wait api web prometheus" in update
    assert "worker" not in update
    assert "compose up -d --remove-orphans" not in update


def test_preprod_context_refuses_external_compose_context(tmp_path):
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    shutil.copy2(ROOT / "scripts" / "lib.sh", scripts / "lib.sh")
    (repository / ".env.preprod").write_text("POSTGRES_USER=test\n", encoding="utf-8")
    (repository / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / "docker-compose.preprod.yml").write_text("services: {}\n", encoding="utf-8")

    for extra_env in (
        {"COMPOSE_FILE": "other.yml"},
        {"COMPOSE_PROJECT_NAME": "production"},
        {"DOCKER_HOST": "tcp://production.example:2376"},
        {"DOCKER_CONTEXT": "production"},
    ):
        result = subprocess.run(
            ["bash", "-c", 'source scripts/lib.sh; require_preprod_context'],
            cwd=repository,
            env={**os.environ, **extra_env},
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode != 0
        assert "Refus" in result.stderr


def test_disposable_database_name_cannot_target_active_database(tmp_path):
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    shutil.copy2(ROOT / "scripts" / "lib.sh", scripts / "lib.sh")

    invalid_cases = (
        ("", "motorsports_events"),
        ("motorsports_events", "motorsports_events"),
        ("motorsports_backup_check_20260922123456_42", "motorsports_backup_check_20260922123456_42"),
        ("motorsports_backup_check_20260922123456_42;drop", "motorsports_events"),
        ("motorsports_backup_check_../active", "motorsports_events"),
        ("motorsports_backup_check_20260922123456_42", ""),
    )
    for candidate, active in invalid_cases:
        result = subprocess.run(
            [
                "bash",
                "-c",
                'source scripts/lib.sh; require_disposable_database_name "$1" "$2"',
                "test",
                candidate,
                active,
            ],
            cwd=repository,
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode != 0

    accepted = subprocess.run(
        [
            "bash",
            "-c",
            'source scripts/lib.sh; require_disposable_database_name "$1" "$2"',
            "test",
            "motorsports_backup_check_20260922123456_42",
            "motorsports_events",
        ],
        cwd=repository,
        check=False,
    )
    assert accepted.returncode == 0


def test_failed_disposable_restore_cleans_only_created_database(tmp_path):
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    for name in ("verify-backup.sh", "lib.sh", "env_get.py"):
        shutil.copy2(ROOT / "scripts" / name, scripts / name)
    (repository / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / "docker-compose.preprod.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / ".env.preprod").write_text(
        "POSTGRES_USER=tester\nPOSTGRES_DB=motorsports_events\n",
        encoding="utf-8",
    )
    backup = repository / "backup.sql.gz"
    subprocess.run(
        ["gzip", "-c"],
        input="CREATE TABLE events (id integer);\n",
        text=True,
        stdout=backup.open("wb"),
        check=True,
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_docker(bin_dir / "docker")
    log = tmp_path / "docker.log"

    result = subprocess.run(
        ["bash", str(scripts / "verify-backup.sh"), str(backup)],
        cwd=repository,
        env={
            **os.environ,
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "FAKE_DOCKER_LOG": str(log),
            "FAKE_DOCKER_FAIL_PSQL": "true",
        },
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode != 0
    commands = log.read_text(encoding="utf-8").splitlines()
    created = next(command for command in commands if " createdb " in command)
    dropped = next(command for command in commands if " dropdb " in command)
    temporary_name = created.rsplit(" ", 1)[-1]
    assert temporary_name.startswith("motorsports_backup_check_")
    assert dropped.rsplit(" ", 1)[-1] == temporary_name
    assert "motorsports_events" not in dropped


def test_preexisting_disposable_database_is_never_deleted(tmp_path):
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    for name in ("verify-backup.sh", "lib.sh", "env_get.py"):
        shutil.copy2(ROOT / "scripts" / name, scripts / name)
    (repository / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / "docker-compose.preprod.yml").write_text("services: {}\n", encoding="utf-8")
    (repository / ".env.preprod").write_text(
        "POSTGRES_USER=tester\nPOSTGRES_DB=motorsports_events\n",
        encoding="utf-8",
    )
    backup = repository / "backup.sql.gz"
    subprocess.run(
        ["gzip", "-c"],
        input="CREATE TABLE events (id integer);\n",
        text=True,
        stdout=backup.open("wb"),
        check=True,
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_docker(bin_dir / "docker")
    log = tmp_path / "docker.log"

    result = subprocess.run(
        ["bash", str(scripts / "verify-backup.sh"), str(backup)],
        cwd=repository,
        env={
            **os.environ,
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "FAKE_DOCKER_LOG": str(log),
            "FAKE_DOCKER_FAIL_CREATEDB": "true",
        },
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode != 0
    commands = log.read_text(encoding="utf-8")
    assert " createdb " in commands
    assert " dropdb " not in commands
