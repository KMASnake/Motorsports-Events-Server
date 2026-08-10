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

    assert metadata["version"] == "8.1.0-alpha.2-lot.4.2"
    assert all(
        json.loads(path.read_text(encoding="utf-8"))["version"]
        == metadata["version"]
        for path in package_files
    )
