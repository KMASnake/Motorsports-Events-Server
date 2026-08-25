from pathlib import Path
import json


ROOT = Path(__file__).resolve().parent.parent


def test_workspace_packages_match_version_metadata():
    metadata = json.loads((ROOT / "VERSION.json").read_text(encoding="utf-8"))
    package_files = [
        ROOT / "package.json",
        ROOT / "apps" / "api" / "package.json",
        ROOT / "apps" / "web" / "package.json",
        ROOT / "packages" / "types" / "package.json",
    ]

    assert all(
        json.loads(path.read_text(encoding="utf-8"))["version"]
        == metadata["version"]
        for path in package_files
    )


def test_api_image_receives_release_metadata_as_build_arguments():
    dockerfile = (ROOT / "apps" / "api" / "Dockerfile").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    for name in ("APP_VERSION", "GIT_SHA", "BUILD_TIME"):
        assert f"ARG {name}=unknown" in dockerfile
        assert f"{name}=${{{name}}}" in dockerfile
        assert f"{name}: ${{{name}:-unknown}}" in compose

    assert "x-api-build: &api-build" in compose
    assert compose.count("build: *api-build") == 2
    assert "GIT_SHA: ${GIT_SHA:-unknown}" not in compose.split("environment:", 1)[1]
