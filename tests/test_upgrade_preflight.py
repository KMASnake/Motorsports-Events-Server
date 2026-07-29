from pathlib import Path


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
