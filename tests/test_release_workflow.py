from pathlib import Path
import argparse
import importlib.util
import os
import subprocess
import tempfile
import unittest
from unittest import mock
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
ARCHIVER_PATH = ROOT / "scripts" / "build-release-archive.py"


def load_archiver():
    spec = importlib.util.spec_from_file_location("build_release_archive", ARCHIVER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_release_artifact_requires_all_test_jobs():
    workflow = (
        ROOT / ".github" / "workflows" / "validate.yml"
    ).read_text(encoding="utf-8")

    release = workflow[workflow.index("  release-artifact:"):]
    assert "needs: [validate, postgres-integration]" in release
    assert "run: ./scripts/build-release.sh" in release
    assert "cd dist" in release
    assert '"motorsports-events-server-$(cat ../VERSION).zip.sha256"' in release
    assert "uses: actions/upload-artifact@v4" in release
    assert "dist/*.zip" in release
    assert "dist/*.zip.sha256" in release
    assert "if-no-files-found: error" in release


def test_release_checksum_uses_a_portable_filename():
    builder = (
        ROOT / "scripts" / "build-release.sh"
    ).read_text(encoding="utf-8")

    assert 'cd "${DIST}"' in builder
    assert 'sha256sum "$(basename "${ARCHIVE}")"' in builder


def test_release_builder_embeds_identifiable_metadata():
    builder = (ROOT / "scripts" / "build-release.sh").read_text(encoding="utf-8")
    archiver = (ROOT / "scripts" / "build-release-archive.py").read_text(encoding="utf-8")

    assert 'SOURCE_SHA="$(git rev-parse --verify \'HEAD^{commit}\')"' in builder
    assert 'GIT_SHA="${GIT_SHA:-${SOURCE_SHA}}"' in builder
    assert '"${GIT_SHA}" != "${SOURCE_SHA}"' in builder
    assert 'BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"' in builder
    assert 'build-release-archive.py' in builder
    assert 'release-metadata.json' in archiver
    assert '"version": arguments.version' in archiver
    assert '"git_sha": commit' in archiver
    assert '"build_time": arguments.build_time' in archiver
    assert 'release-build.env' in builder
    assert "docker compose --env-file" in builder


def git(repository: Path, *arguments: str, env: dict[str, str] | None = None) -> str:
    return subprocess.run(
        ["git", "-C", str(repository), *arguments],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()


def release_fixture(tmp_path: Path) -> tuple[Path, str, Path]:
    repository = tmp_path / "repository"
    repository.mkdir()
    git(repository, "init", "--quiet")
    git(repository, "config", "user.name", "Release Test")
    git(repository, "config", "user.email", "release-test@example.invalid")
    tracked = {
        "README.md": "committed release content\n",
        "VERSION": "test-version\n",
        "docker-compose.yml": "services: {}\n",
        ".env.example": "SAFE_EXAMPLE=value\n",
        ".env.preprod.example": "SAFE_PREPROD_EXAMPLE=value\n",
        "scripts/install.sh": "#!/bin/sh\nexit 0\n",
    }
    for relative, content in tracked.items():
        path = repository / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    (repository / "scripts/install.sh").chmod(0o755)
    git(repository, "add", "--", *tracked)
    commit_env = {
        **os.environ,
        "GIT_AUTHOR_DATE": "2026-01-02T03:04:05Z",
        "GIT_COMMITTER_DATE": "2026-01-02T03:04:05Z",
    }
    git(repository, "commit", "--quiet", "-m", "release fixture", env=commit_env)
    commit = git(repository, "rev-parse", "HEAD")
    output = tmp_path / "release.zip"
    return repository, commit, output


def run_archive(repository: Path, commit: str, output: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "python3",
            str(ARCHIVER_PATH),
            "--repository", str(repository),
            "--commit", commit,
            "--output", str(output),
            "--version", "test-version",
            "--git-sha", commit,
            "--build-time", "2026-01-02T03:04:05Z",
        ],
        capture_output=True,
        text=True,
    )


class ReleasePackagingTests(unittest.TestCase):
    def test_release_archive_uses_only_committed_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            repository, commit, output = release_fixture(Path(directory))
            untracked = [
                ".env",
                ".env.preprod",
                ".env.production",
                ".env.local",
                ".env.test.local",
                "local-secret.txt",
                "docker-compose.yml.bak-test",
                "untracked-note.txt",
            ]
            for name in untracked:
                (repository / name).write_text("FAKE_TEST_VALUE_ONLY\n", encoding="utf-8")
            (repository / "README.md").write_text("uncommitted content\n", encoding="utf-8")

            result = run_archive(repository, commit, output)
            self.assertEqual(result.returncode, 0, result.stderr)
            second_output = Path(directory) / "release-second.zip"
            second = run_archive(repository, commit, second_output)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(output.read_bytes(), second_output.read_bytes())
            with ZipFile(output) as archive:
                names = set(archive.namelist())
                prefix = "motorsports-events-server/"
                self.assertEqual(archive.read(prefix + "README.md"), b"committed release content\n")
                for name in (
                    "VERSION",
                    "docker-compose.yml",
                    "scripts/install.sh",
                    ".env.example",
                    ".env.preprod.example",
                    "release-metadata.json",
                ):
                    self.assertIn(prefix + name, names)
                self.assertTrue(all(prefix + name not in names for name in untracked))
                self.assertTrue(all(not name.startswith(prefix + ".git/") for name in names))

    def test_release_archive_refuses_every_tracked_sensitive_environment_variant(self):
        for name in (".env", ".env.preprod", ".env.production", ".env.local", ".env.test.local"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                repository, _, output = release_fixture(Path(directory))
                (repository / name).write_text("FAKE_TEST_VALUE_ONLY\n", encoding="utf-8")
                git(repository, "add", "--", name)
                git(repository, "commit", "--quiet", "-m", "unsafe fixture")
                commit = git(repository, "rev-parse", "HEAD")

                result = run_archive(repository, commit, output)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Fichier d'environnement sensible suivi par Git", result.stderr)
                self.assertFalse(output.exists())

    def test_release_archive_refuses_paths_outside_its_prefix(self):
        archiver = load_archiver()
        for path in ("/absolute", "../outside", "folder/../../outside", "folder/../outside"):
            with self.subTest(path=path), self.assertRaises(SystemExit):
                archiver.archive_path(path)
        self.assertEqual(
            str(archiver.archive_path("scripts/install.sh")),
            "motorsports-events-server/scripts/install.sh",
        )

    def test_release_archive_keeps_final_output_atomic_on_mid_build_failure(self):
        archiver = load_archiver()
        with tempfile.TemporaryDirectory() as directory:
            repository, commit, output = release_fixture(Path(directory))
            output.write_bytes(b"previous-valid-artifact")
            arguments = argparse.Namespace(
                repository=repository,
                commit=commit,
                output=output,
                version="test-version",
                git_sha=commit,
                build_time="2026-01-02T03:04:05Z",
            )
            real_git = archiver.git
            blob_reads = 0

            def interrupted_git(repository_path, *arguments):
                nonlocal blob_reads
                if arguments[:2] == ("cat-file", "blob"):
                    blob_reads += 1
                    if blob_reads == 2:
                        raise SystemExit("controlled test interruption")
                return real_git(repository_path, *arguments)

            with mock.patch.object(archiver, "git", side_effect=interrupted_git):
                with self.assertRaisesRegex(SystemExit, "controlled test interruption"):
                    archiver.build(arguments)

            self.assertEqual(output.read_bytes(), b"previous-valid-artifact")
            self.assertFalse(output.with_name(f"{output.name}.partial").exists())
