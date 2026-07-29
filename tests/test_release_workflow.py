from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_release_artifact_requires_all_test_jobs():
    workflow = (
        ROOT / ".github" / "workflows" / "validate.yml"
    ).read_text(encoding="utf-8")

    release = workflow[workflow.index("  release-artifact:"):]
    assert "needs: [validate, postgres-integration]" in release
    assert "run: ./scripts/build-release.sh" in release
    assert "run: sha256sum -c dist/*.zip.sha256" in release
    assert "uses: actions/upload-artifact@v4" in release
    assert "dist/*.zip" in release
    assert "dist/*.zip.sha256" in release
    assert "if-no-files-found: error" in release
