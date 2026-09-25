import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import re


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts/validate-f4-stabilization.mjs"
F4_CONTRACT_FILES = (
    ".github/workflows/validate.yml",
    "docs/handbook/architecture/ADR-0023-CANONICAL-TAXONOMY.md",
    "docs/handoff/PROGRESS.json",
    "docs/handoff/LOT-5.7-P-F4-STABILIZATION-CERTIFICATION.md",
    "docs/handoff/LOT-5.7-P-F5-1-CANONICAL-TAXONOMY.md",
    "docs/handoff/LOT-5.7-P-F5-2-CHAMPIONSHIP-SEASONS.md",
    "docs/handoff/LOT-5.7-P-F5-3-CANONICAL-VENUES.md",
    "docs/handoff/LOT-5.7-P-F5-4-PROVIDER-DISCOVERY-RESOLUTION.md",
    "docs/handbook/architecture/ADR-0026-PROVIDER-DISCOVERY-RESOLUTION.md",
    "docs/handoff/VPS-PREPRODUCTION-READINESS.md",
)


def run_validator(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(VALIDATOR), "--root", str(ROOT), *arguments],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def run_validator_script(script: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(script), "--root", str(ROOT), *arguments],
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


def changed_progress(directory: Path, mutate) -> Path:
    value = json.loads((ROOT / "docs/handoff/PROGRESS.json").read_text())
    mutate(value)
    target = directory / "progress.json"
    target.write_text(json.dumps(value), encoding="utf-8")
    return target


def f4_state(value: dict) -> dict:
    return value["current"]["sub_lot_5_7_p"]["technical_gates"]["5.7-P-F"][
        "preproduction_stabilization_f4"
    ]


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
    for relative in F4_CONTRACT_FILES:
        (repository / relative).write_bytes((ROOT / relative).read_bytes())
    operation(repository)
    git(repository, "add", "-A")
    git(repository, "commit", "--quiet", "-m", "invalid closure descendant")
    return repository


class F4StabilizationTests(unittest.TestCase):
    def test_contract_passes(self) -> None:
        result = run_validator()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"status":"pass"', result.stdout)
        self.assertIn('"f4_5":"maintainer-validated"', result.stdout)
        self.assertIn('"f4_6":"maintainer-validated"', result.stdout)
        self.assertIn('"f4":"complete"', result.stdout)

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
            for relative in F4_CONTRACT_FILES:
                (repository / relative).write_bytes((ROOT / relative).read_bytes())
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

    def test_wrong_final_f4_snapshot_identity_is_refused(self) -> None:
        source = VALIDATOR.read_text(encoding="utf-8")
        cases = (
            "76e7540bf4589e1c1dda4b461a4667150537a65b",
            "6867c3bd602168d117d7de42121823336edd6a68",
        )
        for value in cases:
            with self.subTest(value=value), tempfile.TemporaryDirectory() as raw:
                script = Path(raw) / "validator.mjs"
                script.write_text(source.replace(value, "0" * 40, 1), encoding="utf-8")
                self.assertNotEqual(run_validator_script(script).returncode, 0)

    def test_post_f4_descendant_changes_do_not_expand_historical_closure_allowlist(self) -> None:
        cases = ("apps/api/src/f5-descendant.ts", "docs/handoff/F5-DESCENDANT.md")
        for relative in cases:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as raw:
                def add_file(repository: Path, path=relative) -> None:
                    target = repository / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text("invalid closure fixture\n", encoding="utf-8")

                repository = closure_descendant(Path(raw), add_file)
                result = run_validator("--root", str(repository))
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_post_f4_descendant_rename_or_copy_does_not_rewrite_historical_snapshot(self) -> None:
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
                self.assertEqual(result.returncode, 0, result.stderr)

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
                "F4 global: **COMPLETE**",
                "F4 global: **NOT YET MAINTAINER-VALIDATED**",
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

    def test_f4_5_identity_status_and_ci_are_fail_closed(self) -> None:
        cases = (
            lambda value: f4_state(value)["subphases"]["F4-5"].update(status="in-progress"),
            lambda value: f4_state(value)["subphases"]["F4-5"].update(maintainer_validated=False),
            lambda value: f4_state(value)["subphases"]["F4-5"].update(git_head="0" * 40),
            lambda value: f4_state(value)["subphases"]["F4-5"].update(git_tree="0" * 40),
            lambda value: f4_state(value)["f4_5_closure"].update(git_head="0" * 40),
            lambda value: f4_state(value)["f4_5_closure"].update(git_tree="0" * 40),
            lambda value: f4_state(value)["f4_5_closure"]["ci"]["legacy"].update(run_number=262),
            lambda value: f4_state(value)["f4_5_closure"]["ci"]["legacy"].update(conclusion="FAILURE"),
            lambda value: f4_state(value)["f4_5_closure"]["ci"]["node"].update(run_number=531),
            lambda value: f4_state(value)["f4_5_closure"]["ci"]["node"].update(conclusion="FAILURE"),
        )
        for index, mutate in enumerate(cases):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                target = changed_progress(Path(raw), mutate)
                self.assertNotEqual(run_validator("--progress", str(target)).returncode, 0)

    def test_prior_f4_stages_are_fail_closed(self) -> None:
        for stage in ("F4-0", "F4-1", "F4-2", "F4-3", "F4-4"):
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as raw:
                target = changed_progress(
                    Path(raw),
                    lambda value, name=stage: f4_state(value)["subphases"][name].update(status="in-progress"),
                )
                self.assertNotEqual(run_validator("--progress", str(target)).returncode, 0)

    def test_f4_6_identity_status_and_ci_are_fail_closed(self) -> None:
        cases = (
            lambda value: f4_state(value)["subphases"]["F4-6"].update(status="in-progress"),
            lambda value: f4_state(value)["subphases"]["F4-6"].update(implementation_complete=False),
            lambda value: f4_state(value)["subphases"]["F4-6"].update(maintainer_validated=False),
            lambda value: f4_state(value)["subphases"]["F4-6"].update(git_head="0" * 40),
            lambda value: f4_state(value)["subphases"]["F4-6"].update(git_tree="0" * 40),
            lambda value: f4_state(value)["f4_6_closure"].update(git_head="0" * 40),
            lambda value: f4_state(value)["f4_6_closure"].update(git_tree="0" * 40),
            lambda value: f4_state(value)["f4_6_closure"]["ci"]["legacy"].update(run_number=263),
            lambda value: f4_state(value)["f4_6_closure"]["ci"]["legacy"].update(conclusion="FAILURE"),
            lambda value: f4_state(value)["f4_6_closure"]["ci"]["node"].update(run_number=532),
            lambda value: f4_state(value)["f4_6_closure"]["ci"]["node"].update(conclusion="FAILURE"),
        )
        for index, mutate in enumerate(cases):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                target = changed_progress(Path(raw), mutate)
                self.assertNotEqual(run_validator("--progress", str(target)).returncode, 0)

    def test_f5_global_not_started_regression_is_refused(self) -> None:
        def regress_f5(value: dict) -> None:
            f5 = value["current"]["sub_lot_5_7_p"]["technical_gates"]["5.7-P-F"][
                "provider_first_f5"
            ]
            f5.update(status="not-started", implementation_started=False, authorized=False)

        with tempfile.TemporaryDirectory() as raw:
            target = changed_progress(Path(raw), regress_f5)
            result = run_validator("--progress", str(target))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("in-progress", result.stderr)

    def test_f5_production_and_incomplete_f4_are_refused(self) -> None:
        def gate(value: dict) -> dict:
            return value["current"]["sub_lot_5_7_p"]["technical_gates"]["5.7-P-F"]

        cases = (
            lambda value: gate(value)["provider_first_f5"].update(status="complete"),
            lambda value: gate(value)["provider_first_f5"].update(authorized_subphase="F5-4"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"].update(maintainer_validated=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"].update(git_head="0" * 40),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"].update(git_tree="0" * 40),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"]["ci"]["legacy"].update(run_number=267),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"]["ci"]["node"].update(conclusion="FAILURE"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-2"].update(migration_head="0032_f5_canonical_taxonomy"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(maintainer_validated=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(status="in-progress-pending-maintainer-validation"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(authorized=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(implementation_complete=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(migration_head="0033_f5_championship_seasons"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(git_head="0" * 40),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"].update(git_tree="0" * 40),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"]["ci"]["legacy"].update(run_number=269),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-3"]["ci"]["node"].update(conclusion="FAILURE"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(status="maintainer-validated", authorized=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(maintainer_validated=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(implementation_complete=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(migration_head="0034_f5_canonical_venues"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(provider_calls=1),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(worker_started=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-4"].update(scheduler_started=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-5"].update(status="in-progress", authorized=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-6"].update(status="in-progress", authorized=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-7"].update(status="in-progress", authorized=True),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-1"].update(status="in-progress-pending-maintainer-validation"),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-1"].update(maintainer_validated=False),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-1"].update(git_head="0" * 40),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-1"]["ci"]["legacy"].update(run_number=265),
            lambda value: gate(value)["provider_first_f5"]["subphases"]["F5-1"]["ci"]["node"].update(conclusion="FAILURE"),
            lambda value: gate(value).update(production_preview_activation_authorized=True),
            lambda value: gate(value).update(production_authorized=True),
            lambda value: value["current"]["sub_lot_5_7_p"].update(full_lot_5_7_authorized=True),
            lambda value: value["current"].update(merge_authorized=True),
            lambda value: f4_state(value)["subphases"]["F4-6"].update(status="in-progress", implementation_complete=False, maintainer_validated=False),
            lambda value: f4_state(value)["subphases"]["F4-5"].update(status="in-progress"),
            lambda value: f4_state(value).update(status="in-progress", implementation_complete=False, maintainer_validated=False),
        )
        for index, mutate in enumerate(cases):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as raw:
                target = changed_progress(Path(raw), mutate)
                self.assertNotEqual(run_validator("--progress", str(target)).returncode, 0)

    def test_f5_1_governance_documents_are_fail_closed(self) -> None:
        cases = (
            (
                "docs/handoff/LOT-5.7-P-F5-2-CHAMPIONSHIP-SEASONS.md",
                "Statut : `MAINTAINER_VALIDATED`",
                "Statut : `IN_PROGRESS_PENDING_MAINTAINER_VALIDATION`",
                "--f5-2-doc",
            ),
            (
                "docs/handoff/LOT-5.7-P-F5-1-CANONICAL-TAXONOMY.md",
                "Statut : `MAINTAINER_VALIDATED`",
                "Statut : `IN_PROGRESS_PENDING_MAINTAINER_VALIDATION`",
                "--f5-doc",
            ),
            (
                "docs/handbook/architecture/ADR-0023-CANONICAL-TAXONOMY.md",
                "Statut : validé par le mainteneur dans F5-1",
                "Statut : candidat F5-1, en attente de validation mainteneur",
                "--taxonomy-adr",
            ),
        )
        for relative, old, new, option in cases:
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as raw:
                target = changed_text(Path(raw), relative, old, new)
                self.assertNotEqual(run_validator(option, str(target)).returncode, 0)

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

    def test_progress_must_claim_f4_complete(self) -> None:
        progress = json.loads((ROOT / "docs/handoff/PROGRESS.json").read_text())
        f4 = f4_state(progress)
        f4["status"] = "in-progress"
        f4["implementation_complete"] = False
        f4["maintainer_validated"] = False
        with tempfile.TemporaryDirectory() as raw:
            target = Path(raw) / "progress.json"
            target.write_text(json.dumps(progress), encoding="utf-8")
            result = run_validator("--progress", str(target))
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
