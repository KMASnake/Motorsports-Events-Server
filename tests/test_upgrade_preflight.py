from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parent.parent


def test_preflight_runs_before_upgrade_writes():
    source = (ROOT / "scripts" / "upgrade.sh").read_text(encoding="utf-8")
    assert source.index("preflight-upgrade.sh") < source.index("mkdir -p")
    assert source.index("preflight-upgrade.sh") < source.index("cp -a")


def test_preflight_checks_archive_docker_disk_and_required_files():
    source = (
        ROOT / "scripts" / "preflight-upgrade.sh"
    ).read_text(encoding="utf-8")
    for expected in (
        "unzip -tq",
        "docker info",
        "docker compose config --quiet",
        "AVAILABLE_KB",
        "VERSION install.sh docker-compose.yml scripts/upgrade.sh",
    ):
        assert expected in source


def test_failed_candidate_restores_previous_files_and_persistent_data():
    library = ROOT / "scripts" / "upgrade-files.sh"
    with tempfile.TemporaryDirectory() as temporary:
        parent = Path(temporary)
        current = parent / "server"
        candidate = parent / "candidate"
        rollback = parent / "rollback"
        (current / "data").mkdir(parents=True)
        (current / "VERSION").write_text("old\n", encoding="utf-8")
        (current / "data" / "sentinel").write_text(
            "persistent\n", encoding="utf-8"
        )
        (candidate / "data").mkdir(parents=True)
        (candidate / "VERSION").write_text("new\n", encoding="utf-8")
        (candidate / "data" / "placeholder").write_text(
            "discard\n", encoding="utf-8"
        )

        command = (
            f'source "{library}"; '
            f'activate_candidate_files "{current}" "{candidate}" "{rollback}"; '
            f'test "$(cat "{current}/VERSION")" = new; '
            f'test -f "{current}/data/sentinel"; '
            f'test ! -e "{current}/data/placeholder"; '
            f'test ! -e "{rollback}/data"; '
            f'touch "{current}/failed-runtime"; '
            f'restore_candidate_files "{current}" "{rollback}"; '
            f'test "$(cat "{current}/VERSION")" = old; '
            f'test -f "{current}/data/sentinel"; '
            f'test ! -e "{current}/failed-runtime"; '
            f'test ! -e "{rollback}"'
        )
        subprocess.run(["bash", "-Eeuo", "pipefail", "-c", command], check=True)


def test_rollback_refuses_ambiguous_persistent_data():
    library = ROOT / "scripts" / "upgrade-files.sh"
    with tempfile.TemporaryDirectory() as temporary:
        parent = Path(temporary)
        current = parent / "server"
        rollback = parent / "rollback"
        (current / "data").mkdir(parents=True)
        (rollback / "data").mkdir(parents=True)

        result = subprocess.run(
            [
                "bash",
                "-c",
                (
                    f'source "{library}"; '
                    f'restore_candidate_files "{current}" "{rollback}"'
                ),
            ],
            check=False,
        )

        assert result.returncode != 0
        assert current.is_dir()
        assert rollback.is_dir()


def test_upgrade_preserves_optional_monitoring_state():
    source = (ROOT / "scripts" / "upgrade.sh").read_text(encoding="utf-8")

    assert "MONITORING_WAS_RUNNING=false" in source
    assert "ps --services --status running" in source
    assert source.count('"${PROJECT_ROOT}/scripts/monitoring-start.sh"') == 2
    assert "--remove-orphans" not in source
