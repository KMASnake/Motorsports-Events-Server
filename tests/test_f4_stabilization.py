import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import re


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts/validate-f4-stabilization.mjs"


def run_validator(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(VALIDATOR), "--root", str(ROOT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def changed_json(directory: Path, mutate) -> Path:
    value = json.loads(
        (ROOT / "docs/handoff/evidence/lot57pf4-empty-event-runtime.json").read_text()
    )
    mutate(value)
    target = directory / "evidence.json"
    target.write_text(json.dumps(value), encoding="utf-8")
    return target


def changed_text(directory: Path, relative: str, old: str, new: str) -> Path:
    source = ROOT / relative
    text = source.read_text(encoding="utf-8")
    if old not in text:
        raise AssertionError(f"fixture token absent: {old}")
    target = directory / source.name
    target.write_text(text.replace(old, new, 1), encoding="utf-8")
    return target


def changed_document_fact(directory: Path, relative: str, mutate) -> Path:
    source = ROOT / relative
    text = source.read_text(encoding="utf-8")
    match = re.search(
        r"<!-- F4-STABILIZATION-EVIDENCE\n([\s\S]*?)\nF4-STABILIZATION-EVIDENCE -->",
        text,
    )
    if match is None:
        raise AssertionError(f"evidence marker absent: {relative}")
    value = json.loads(match.group(1))
    mutate(value)
    replacement = json.dumps(value, ensure_ascii=False, indent=2)
    target = directory / source.name
    target.write_text(
        text[: match.start(1)] + replacement + text[match.end(1) :],
        encoding="utf-8",
    )
    return target


def git(repository: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repository), *arguments],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def closure_descendant(directory: Path, operation) -> Path:
    repository = directory / "repository"
    git(ROOT, "clone", "--quiet", "--shared", str(ROOT), str(repository))
    git(repository, "config", "user.name", "F4 Validator Test")
    git(repository, "config", "user.email", "f4-validator@example.invalid")
    git(repository, "cat-file", "-e", "8553fb9c1b69790169f46a6e96ba4f02d8cf6601^{commit}")
    operation(repository)
    git(repository, "add", "-A")
    git(repository, "commit", "--quiet", "-m", "invalid closure descendant")
    return repository


class F4StabilizationTests(unittest.TestCase):
    def test_contract_passes(self) -> None:
        result = run_validator()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"status":"pass"', result.stdout)
        self.assertIn('"f4_5":"in-progress"', result.stdout)

    def test_missing_evidence_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = run_validator("--evidence", str(Path(raw) / "missing.json"))
        self.assertNotEqual(result.returncode, 0)

    def test_shallow_checkout_is_refused_until_history_is_fetched(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            repository = Path(raw) / "repository"
            subprocess.run(
                ["git", "clone", "--quiet", "--depth", "1", f"file://{ROOT}", str(repository)],
                check=True,
            )
            (repository / ".github/workflows/validate.yml").write_bytes(
                (ROOT / ".github/workflows/validate.yml").read_bytes()
            )
            self.assertNotEqual(
                subprocess.run(
                    ["git", "-C", str(repository), "cat-file", "-e", "8553fb9c1b69790169f46a6e96ba4f02d8cf6601^{commit}"],
                    check=False,
                ).returncode,
                0,
            )
            refused = run_validator("--root", str(repository))
            self.assertNotEqual(refused.returncode, 0)
            subprocess.run(
                ["git", "-C", str(repository), "fetch", "--quiet", "--unshallow", "origin"],
                check=True,
            )
            accepted = run_validator("--root", str(repository))
            self.assertEqual(accepted.returncode, 0, accepted.stderr)

    def test_validate_job_requires_full_checkout_history(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workflow = changed_text(
                Path(raw),
                ".github/workflows/validate.yml",
                "          fetch-depth: 0",
                "          fetch-depth: 1",
            )
            result = run_validator("--workflow", str(workflow))
        self.assertNotEqual(result.returncode, 0)

    def test_wrong_baseline_head_or_tree_is_refused(self) -> None:
        for field in ("baseline_git_head", "baseline_git_tree"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as raw:
                evidence = changed_json(
                    Path(raw), lambda value, key=field: value.update({key: "0" * 40})
                )
                result = run_validator("--evidence", str(evidence))
                self.assertNotEqual(result.returncode, 0)

    def test_closure_diff_refuses_extra_application_migration_and_compose_files(self) -> None:
        cases = (
            "apps/api/src/f4-invalid.ts",
            "infra/postgres/migrations/0032_f4_invalid.up.sql",
            "docker-compose.f4-invalid.yml",
        )
        for relative in cases:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as raw:
                def add_file(repository: Path, path=relative) -> None:
                    target = repository / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text("invalid closure fixture\n", encoding="utf-8")

                repository = closure_descendant(Path(raw), add_file)
                result = run_validator("--root", str(repository))
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("allowlist", result.stderr)

    def test_closure_diff_refuses_rename_or_copy(self) -> None:
        operations = (
            lambda repository: git(repository, "mv", "README.md", "README-F4-INVALID.md"),
            lambda repository: (repository / "README-F4-COPY.md").write_bytes(
                (repository / "README.md").read_bytes()
            ),
        )
        for index, operation in enumerate(operations):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                repository = closure_descendant(Path(raw), operation)
                result = run_validator("--root", str(repository))
                self.assertNotEqual(result.returncode, 0)
                self.assertRegex(result.stderr, "rename/copy interdit|allowlist")

    def test_unsafe_runtime_evidence_is_refused(self) -> None:
        cases = (
            lambda value: value.update(provider_calls=1),
            lambda value: value.update(worker_started=True),
            lambda value: value["cleanup"].update(containers=1),
            lambda value: value["cleanup"].update(networks=1),
            lambda value: value["cleanup"].update(temp_dirs=1),
            lambda value: value.update(preprod_mutated=True),
            lambda value: value.update(production_mutated=True),
            lambda value: value.update(calendar_empty=False),
            lambda value: value.update(harness_rc=1),
        )
        for index, mutate in enumerate(cases):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                evidence = changed_json(Path(raw), mutate)
                result = run_validator("--evidence", str(evidence))
                self.assertNotEqual(result.returncode, 0)

    def test_ci_must_be_success(self) -> None:
        for job in ("legacy", "node"):
            with self.subTest(job=job), tempfile.TemporaryDirectory() as raw:
                evidence = changed_json(
                    Path(raw),
                    lambda value, name=job: value["ci"][name].update(
                        conclusion="FAILURE"
                    ),
                )
                result = run_validator("--evidence", str(evidence))
                self.assertNotEqual(result.returncode, 0)

    def test_wrong_migration_head_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            evidence = changed_json(
                Path(raw), lambda value: value.update(migration_head="0030_wrong")
            )
            result = run_validator("--evidence", str(evidence))
        self.assertNotEqual(result.returncode, 0)

    def test_modified_f3_baseline_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            target = Path(raw) / "f3-baseline.json"
            source = ROOT / "docs/handoff/evidence/lot57pf3-prospective-baseline-N.json"
            target.write_bytes(source.read_bytes() + b"\n")
            result = run_validator("--f3-baseline", str(target))
        self.assertNotEqual(result.returncode, 0)

    def test_stale_or_contradictory_documentation_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            stale = changed_text(
                Path(raw),
                "docs/handoff/LOT-5.7-P-F4-EMPTY-EVENT-BASELINE.md",
                "Validation runtime mainteneur : **PASS**",
                "Validation runtime mainteneur : PENDING",
            )
            self.assertNotEqual(
                run_validator("--empty-doc", str(stale)).returncode, 0
            )
        with tempfile.TemporaryDirectory() as raw:
            contradictory = changed_text(
                Path(raw),
                "docs/handoff/LOT-5.7-P-F4-STABILIZATION-CERTIFICATION.md",
                "F4 global: **NOT YET MAINTAINER-VALIDATED**",
                "F4 global: **COMPLETE**",
            )
            self.assertNotEqual(
                run_validator("--certification", str(contradictory)).returncode, 0
            )

    def test_every_documented_runtime_fact_is_cross_checked(self) -> None:
        cases = (
            lambda value: value.update(baseline_git_head="0" * 40),
            lambda value: value.update(baseline_git_tree="0" * 40),
            lambda value: value.update(migration_head="0030_wrong"),
            lambda value: value.update(runtime_mode="native"),
            lambda value: value.update(calendar_empty=False),
            lambda value: value.update(harness_rc=1),
            lambda value: value["cleanup"].update(containers=1),
            lambda value: value.update(provider_calls=1),
            lambda value: value.update(worker_started=True),
            lambda value: value.update(preprod_mutated=True),
            lambda value: value.update(production_mutated=True),
            lambda value: value["ci"]["legacy"].update(run_number=260),
            lambda value: value["ci"]["node"].update(conclusion="FAILURE"),
        )
        for index, mutate in enumerate(cases):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                document = changed_document_fact(
                    Path(raw),
                    "docs/handoff/LOT-5.7-P-F4-STABILIZATION-CERTIFICATION.md",
                    mutate,
                )
                result = run_validator("--certification", str(document))
                self.assertNotEqual(result.returncode, 0)

    def test_progress_runtime_facts_are_cross_checked(self) -> None:
        progress = json.loads((ROOT / "docs/handoff/PROGRESS.json").read_text())
        facts = progress["current"]["sub_lot_5_7_p"]["technical_gates"]["5.7-P-F"][
            "preproduction_stabilization_f4"
        ]["runtime_certification"]
        facts["baseline_git_tree"] = "0" * 40
        with tempfile.TemporaryDirectory() as raw:
            target = Path(raw) / "progress.json"
            target.write_text(json.dumps(progress), encoding="utf-8")
            result = run_validator("--progress", str(target))
        self.assertNotEqual(result.returncode, 0)

    def test_packaging_operation_and_schema_regressions_are_refused(self) -> None:
        cases = (
            ("archiver", "scripts/build-release-archive.py", '"ls-tree"', "git inventory removed"),
            (
                "operations",
                "scripts/lib.sh",
                "    -p mse-preprod \\",
                "    -p unsafe-project \\",
            ),
            (
                "schema",
                "apps/api/src/lib/schemaCompatibility.ts",
                "APPLICATION_SCHEMA_HEAD = APPLICATION_SCHEMA_MIGRATIONS.at(-1)",
                "APPLICATION_SCHEMA_HEAD = 'unknown'",
            ),
            (
                "health",
                "apps/api/src/routes/health.ts",
                "const readiness = await databaseReadiness();",
                "const readiness = await compatibilityRemoved();",
            ),
            (
                "empty-harness",
                "scripts/test-f4-empty-event-database.sh",
                "PREVIEW_API_ENABLED=false",
                "PREVIEW_API_ENABLED=true",
            ),
        )
        for option, relative, old, new in cases:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as raw:
                altered = changed_text(Path(raw), relative, old, new)
                result = run_validator(f"--{option}", str(altered))
                self.assertNotEqual(result.returncode, 0)

    def test_progress_cannot_claim_f4_complete(self) -> None:
        progress = json.loads((ROOT / "docs/handoff/PROGRESS.json").read_text())
        f4 = progress["current"]["sub_lot_5_7_p"]["technical_gates"]["5.7-P-F"][
            "preproduction_stabilization_f4"
        ]
        f4["status"] = "complete"
        f4["implementation_complete"] = True
        f4["maintainer_validated"] = True
        with tempfile.TemporaryDirectory() as raw:
            target = Path(raw) / "progress.json"
            target.write_text(json.dumps(progress), encoding="utf-8")
            result = run_validator("--progress", str(target))
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
