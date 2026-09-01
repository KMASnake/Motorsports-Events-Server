import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PREFLIGHT = ROOT / "scripts" / "validate-lot57pf3-preflight.mjs"
EVIDENCE = ROOT / "scripts" / "build-lot57pf3-evidence.mjs"
RUNTIME_PROBE = ROOT / "scripts" / "capture-lot57pf3-runtime-snapshot.mjs"
BASELINE_PROBE = ROOT / "scripts" / "capture-lot57pf3-prospective-baseline.mjs"
PHASE2_RUNNER = ROOT / "scripts" / "run-lot57pf3-phase2.sh"
PHASE2_CURSOR = ROOT / "scripts" / "validate-lot57pf3-phase2-cursor.mjs"
PHASE2_EVIDENCE = ROOT / "scripts" / "validate-lot57pf3-phase2-evidence.mjs"


def snapshot(**overrides):
    def image(version, sha_digit, id_digit, digest_digit, hour):
        component = "api" if id_digit in ("a", "c") else "web"
        release = "release-n" if version == "1.0.0" else "release-n1"
        digest = "sha256:" + digest_digit * 64
        tree_digit = "e" if version == "1.0.0" else "f"
        return {"runtime_ref": f"registry.example/{release}-{component}@{digest}", "runtime_manifest_digest": digest, "config_digest": "sha256:" + id_digit * 64, "rootfs_diff_ids": ["sha256:" + digest_digit * 64, "sha256:" + id_digit * 64], "version": version, "git_sha": sha_digit * 40, "git_tree": tree_digit * 40, "build_time": f"2026-08-28T{hour}:00:00Z"}
    value = {
        "worker_running": False,
        "provider_execution_enabled": False,
        "championship_execution_enabled": False,
        "scheduler_enabled": False,
        "discovery_enabled": False,
        "provider_network_blocked": True,
        "provider_network_block_mechanism": "firewall-deny-egress",
        "preview_production_enabled": False,
        "production_target": False,
        "runtime_release": "n_plus_1",
        "releases": {
            "n": {"api": image("1.0.0", "1", "a", "1", "10"), "web": image("1.0.0", "1", "b", "2", "10")},
            "n_plus_1": {"api": image("1.0.1", "2", "c", "3", "11"), "web": image("1.0.1", "2", "d", "4", "11")},
        },
    }
    value.update(overrides)
    return value


def baseline_artifact():
    release = snapshot()["releases"]["n"]
    def component(value):
        return {"oci_provenance": {"historical_immutable_ref": value["runtime_ref"], "historical_index_digest": value["runtime_manifest_digest"], "attestation_digest": None, "attestation_blob_available": None}, "executable_identity": value}
    return {
        "schema": "lot57pf3-prospective-baseline-v2", "prospective_certification_baseline": True,
        "classification": "prospective-certification-baseline", "historical_pre_existing_release": False, "runtime_identity_complete": True,
        "established_at": "2026-08-28T10:30:00Z", "release": {"git_sha": release["api"]["git_sha"], "git_tree": release["api"]["git_tree"], "version": release["api"]["version"], "api": component(release["api"]), "web": component(release["web"])},
        "migration_head": "0031_dynamic_test", "database_integrity": {"classification": "aggregate-integrity-anchor", "aggregate_anchor": "f" * 64, "values": {}, "continuity_requires_independent_checks": True},
        "continuity": {"change_sequence": 7, "event_revision": 3, "meeting_revision": 2, "normalization_checkpoint_count": 1},
        "runtime_safety": {"target": "preproduction", "worker_state": "stopped", "provider_execution_enabled": False, "championship_execution_enabled": False, "scheduler_enabled": False, "discovery_enabled": False, "preview_production_enabled": False, "provider_network_blocked": True, "provider_network_block_mechanism": "container-egress-deny"},
        "provenance": {"source": "repository-runtime-inspection", "git_tree_source": "git-rev-parse-commit-tree", "compose_project": "mse-preprod", "certification_container": "mse-f3-certification-runner", "certification_network": "mse-f3-certification-internal", "exclusive_network_attachment": True},
    }


def run_preflight(value, baseline_value=None):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "snapshot.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        baseline = Path(directory) / "baseline.json"
        baseline.write_text(json.dumps(baseline_value or baseline_artifact()), encoding="utf-8")
        return subprocess.run(["node", str(PREFLIGHT), str(path), str(baseline)], cwd=ROOT, text=True, capture_output=True, check=False)


def fake_docker(directory, mode="safe"):
    executable = Path(directory) / "docker"
    executable.write_text("""#!/usr/bin/env python3
import json,os,sys
a=sys.argv[1:];mode=os.environ.get('F3_FAKE_MODE','safe')
if a[0]=='compose' and 'ps' in a:
    service=a[-1];print({'postgres':'postgres-id','api':'api-id','web':'web-id','worker':'worker-id'}[service]);sys.exit(0)
if a[0]=='compose' and 'exec' in a:
    if 'schema_migrations' in a[-1]:
        print(json.dumps({'migration_head':'0031_dynamic_test','events_count':2,'meetings_count':1,'changes_max_sequence':7,'events_max_revision':3,'meetings_max_revision':2,'normalization_checkpoints_count':1,'orphan_meeting_events':0}));sys.exit(0)
    state={'provider_execution_enabled':False,'championship_execution_enabled':False,'scheduler_execution_active':False,'discovery_enabled':False}
    if mode=='provider':state['provider_execution_enabled']=True
    if mode=='unknown':sys.exit(2)
    print(json.dumps(state));sys.exit(0)
if a[0]=='inspect':
    name=a[1];running=name!='worker-id' or mode=='worker';project='production' if mode=='production' else 'mse-preprod'
    env=['POSTGRES_USER=mse','POSTGRES_DB=motorsports_events'] if name=='postgres-id' else ['NODE_ENV=production','PREVIEW_API_ENABLED='+('true' if mode=='preview' else 'false')]
    networks={'mse-f3-certification-internal':{}}
    labels={'com.docker.compose.project':project}
    image='sha256:'+((('b' if name=='web-id' else 'a') if mode.startswith('baseline') else ('d' if name=='web-id' else 'c')))*64
    if mode=='runtime-api-wrong' and name=='api-id':image='sha256:'+'a'*64
    if mode=='runtime-web-wrong' and name=='web-id':image='sha256:'+'b'*64
    if mode.endswith('runtime-worker-wrong') and name=='worker-id':image='sha256:'+('c' if mode.startswith('baseline') else 'a')*64
    if name=='mse-f3-certification-runner':
        labels={'com.mse.certification':'lot57pf3','com.mse.certification.target':'preproduction'}
        running=mode!='runner-stopped'
        if mode=='network-multi':networks['mse-preprod_default']={}
        if mode=='network-ordinary':networks={'mse-preprod_default':{}}
        if mode=='network-empty':networks={}
    print(json.dumps([{'State':{'Running':running},'Image':image,'Config':{'Env':env,'Labels':labels},'NetworkSettings':{'Networks':networks}}]));sys.exit(0)
if a[:2]==['network','inspect']:
    if mode=='network-unknown':sys.exit(2)
    print(json.dumps([{'Name':'mse-f3-certification-internal','Internal':mode!='network-open'}]));sys.exit(0)
if a[:2]==['image','inspect']:
    ref=a[2]
    values={'release-n-api@':('a','1','0','10'),'release-n-web@':('b','1','0','10'),'release-n1-api@':('c','2','1','11'),'release-n1-web@':('d','2','1','11')}
    selected=next(value for marker,value in values.items() if marker in ref);image_digit,sha_digit,patch,hour=selected
    metadata=['APP_VERSION=1.0.'+patch,'GIT_SHA='+sha_digit*40,'BUILD_TIME=2026-08-28T'+hour+':00:00Z']
    if mode=='web-metadata-unknown' and 'web@' in ref:metadata=['APP_VERSION=unknown','GIT_SHA=unknown','BUILD_TIME=unknown']
    print(json.dumps([{'Id':'sha256:'+image_digit*64,'RepoDigests':[ref],'RootFS':{'Type':'layers','Layers':['sha256:'+ref.rsplit(':',1)[1], 'sha256:'+image_digit*64]},'Config':{'Env':metadata}}]));sys.exit(0)
sys.exit(3)
""", encoding="utf-8")
    executable.chmod(0o755)
    return executable


def fake_git(directory):
    executable = Path(directory) / "git"
    executable.write_text("""#!/usr/bin/env python3
import sys
sha=sys.argv[-1].split('^',1)[0]
print(('e' if sha.startswith('1') else 'f')*40)
""", encoding="utf-8")
    executable.chmod(0o755)


def run_runtime_probe(tmp_path, mode="safe", extra_args=()):
    fake_docker(tmp_path, mode)
    fake_git(tmp_path)
    env = dict(__import__("os").environ)
    env["PATH"] = f"{tmp_path}:{env['PATH']}"
    env["F3_FAKE_MODE"] = mode
    env_file, output = Path(tmp_path) / ".env.preprod", Path(tmp_path) / "snapshot.json"
    env_file.write_text("non-secret-test-config=true\n", encoding="utf-8")
    env["F3_PREPROD_ENV_FILE"] = str(env_file)
    refs = {
        "n_api": "registry.example/release-n-api@sha256:" + "1" * 64,
        "n_web": "registry.example/release-n-web@sha256:" + "2" * 64,
        "n1_api": "registry.example/release-n1-api@sha256:" + "3" * 64,
        "n1_web": "registry.example/release-n1-web@sha256:" + "4" * 64,
    }
    command = ["node", str(RUNTIME_PROBE), "--n-api-image", refs["n_api"], "--n-web-image", refs["n_web"], "--n-plus-one-api-image", refs["n1_api"], "--n-plus-one-web-image", refs["n1_web"], "--runtime-release", "n-plus-one", "--output", str(output), *extra_args]
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    return result, output


def run_baseline_probe(tmp_path, mode="baseline-safe"):
    fake_docker(tmp_path, mode)
    fake_git(tmp_path)
    env = dict(__import__("os").environ)
    env["PATH"] = f"{tmp_path}:{env['PATH']}"
    env["F3_FAKE_MODE"] = mode
    env_file, output = Path(tmp_path) / ".env.preprod", Path(tmp_path) / "baseline.json"
    env_file.write_text("non-secret-test-config=true\n", encoding="utf-8")
    env["F3_PREPROD_ENV_FILE"] = str(env_file)
    n = snapshot()["releases"]["n"]
    command = ["node", str(BASELINE_PROBE), "--n-api-image", n["api"]["runtime_ref"], "--n-web-image", n["web"]["runtime_ref"], "--output", str(output)]
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    return result, output


def evidence_input():
    return {
        "prospective_baseline": baseline_artifact(),
        "release": snapshot()["releases"],
        "migration_heads": {name: "0031_dynamic_test" for name in ("before", "n_plus_1", "rollback_n", "final_n_plus_1")},
        "db_fingerprints": {name: "a" * 64 for name in ("before", "n_plus_1", "rollback_n", "final_n_plus_1", "restored_disposable")},
        "comparisons": {name: True for name in ("meeting_uuid_stable", "event_uuid_stable", "revision_monotone", "sequence_monotone", "cursor_before_valid_after_rollback", "cursor_after_valid_after_rollback")},
        "incremental_change": {"count": 1, "operation": "updated", "changed_fields": ["name", "startsAt"], "starts_at_source_b": True, "name_override_preserved": True},
        "checks": {name: True for name in ("health", "health_live", "health_ready", "cors_allowed_origin", "cors_foreign_denied", "tls", "metrics")},
        "backup_restore": {"backup_verified": True, "disposable_restore_db": True, "restore_integrity_match": True},
        "provider_calls": 0,
        "worker_state": "stopped",
    }


def phase2_evidence_input():
    names = ["n-pre-migration", "n-post-forward-migration", "n-plus-one", "rollback-n", "final-n-plus-one"]
    runtimes = ["n", "n", "n_plus_1", "n", "n_plus_1"]
    states = {}
    for index, (name, runtime) in enumerate(zip(names, runtimes)):
        runtime_snapshot = snapshot(runtime_release=runtime)
        runtime_snapshot["provider_network_block_mechanism"] = "container-egress-deny"
        states[name] = {
            "label": name,
            "runtime_release": runtime,
            "snapshot": runtime_snapshot,
            "database": {
                "migration_head": "0031_dynamic_test" if index == 0 else "0032_forward_test",
                "change_sequence": 7 + index,
                "event_revision": 3 + index,
                "meeting_revision": 2 + index,
                "normalization_checkpoint_count": 1,
                "uuid_anchor": "a" * 32,
                "relationship_anchor": "b" * 32,
                "orphan_relationships": 0,
            },
            "checks": {key: True for key in ("health", "health_live", "health_ready", "tls", "cors_allowed_origin", "cors_foreign_denied", "metrics")},
            "cursor_before_valid": True,
            "cursor_after_valid": index >= 2,
        }
    return {
        "schema": "lot57pf3-phase2-raw-v1",
        "sequence": names,
        "prospective_baseline": baseline_artifact(),
        "states": states,
        "backup_restore": {"backup_verified": True, "disposable_restore_db": True, "restore_integrity_match": True},
        "provider_calls": 0,
        "provider_credits": 0,
        "worker_started": False,
        "cleanup_verified": True,
    }


def run_phase2_evidence(value):
    directory = tempfile.TemporaryDirectory()
    source, output = Path(directory.name) / "raw.json", Path(directory.name) / "evidence.json"
    source.write_text(json.dumps(value), encoding="utf-8")
    result = subprocess.run(["node", str(PHASE2_EVIDENCE), str(source), str(output)], cwd=ROOT, text=True, capture_output=True, check=False)
    return directory, result, output


class Lot57Pf3ToolingTests(unittest.TestCase):
    def test_phase2_runner_is_dedicated_fail_closed_and_never_uses_destructive_rollback(self):
        runner = PHASE2_RUNNER.read_text(encoding="utf-8")
        self.assertIn("F3_PHASE2_EXECUTION_AUTHORIZED", runner)
        self.assertIn("validate-lot57pf3-preflight.mjs", runner)
        self.assertIn("capture-lot57pf3-runtime-snapshot.mjs", runner)
        self.assertEqual(runner.count("up -d --no-build --no-deps api web"), 1)
        self.assertIn("transition n-plus-one", runner)
        self.assertIn("transition rollback-n", runner)
        self.assertIn("transition final-n-plus-one", runner)
        self.assertNotIn("compose down", runner)
        self.assertNotIn("migrate.sh down", runner)
        self.assertNotIn("docker prune", runner)
        self.assertNotIn("test-lot57pf3-operational-closure.sh", runner)
        self.assertIn("SAFE_RUNTIME_LEFT", runner)
        self.assertIn("disposable restore integrity", runner)
        self.assertIn("cursor_verify", runner)
        self.assertIn("n-post-forward-migration", runner)
        self.assertLess(runner.index('run --rm -T migrate'), runner.index('transition n-plus-one'))
        self.assertLess(runner.index('record_state n-post-forward-migration'), runner.index('transition n-plus-one'))
        self.assertIn("dropdb --if-exists", runner)
        self.assertIn("grep -Fxq -- \"$restore_db\"", runner)
        self.assertIn('docker inspect "$cert_runner"', runner)
        self.assertIn("label=com.mse.certification=lot57pf3", runner)
        self.assertIn("validate-lot57pf3-phase2-evidence.mjs", runner)

    def test_phase2_evidence_requires_complete_five_state_sequence(self):
        directory, result, output = run_phase2_evidence(phase2_evidence_input())
        with directory:
            self.assertEqual(result.returncode, 0, result.stderr)
            evidence = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(evidence["status"], "eligible-for-maintainer-validation")
            self.assertFalse(evidence["pp178_automatically_claimed_pass"])
            self.assertEqual(len(evidence["states"]), 5)

    def test_phase2_evidence_fails_closed_on_cleanup_state_and_continuity(self):
        mutations = (
            lambda value: value.update(cleanup_verified=False),
            lambda value: value["states"]["n-post-forward-migration"]["checks"].update(health_ready=False),
            lambda value: value["states"]["n-post-forward-migration"].update(cursor_before_valid=False),
            lambda value: value["states"]["n-post-forward-migration"]["database"].update(uuid_anchor="c" * 32),
            lambda value: value["states"]["rollback-n"]["database"].update(migration_head="0033_wrong_head"),
            lambda value: value.update(provider_calls=1),
            lambda value: value.update(worker_started=True),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                raw = phase2_evidence_input(); mutate(raw)
                directory, result, output = run_phase2_evidence(raw)
                with directory:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())

    def test_phase2_evidence_refuses_release_identity_regressions(self):
        mutations = (
            lambda value: value["states"]["n-plus-one"]["snapshot"]["releases"]["n_plus_1"]["web"].update(git_sha="9" * 40),
            lambda value: [state["snapshot"]["releases"]["n_plus_1"][component].update(git_tree="e" * 40) for state in value["states"].values() for component in ("api", "web")],
            lambda value: value["states"]["final-n-plus-one"]["snapshot"]["releases"]["n"]["api"].update(runtime_manifest_digest="sha256:" + "9" * 64),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                raw = phase2_evidence_input(); mutate(raw)
                directory, result, output = run_phase2_evidence(raw)
                with directory:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())

    def test_phase2_cursor_probe_blocks_fetch_and_uses_real_preview_repository(self):
        probe = PHASE2_CURSOR.read_text(encoding="utf-8")
        self.assertIn("external_provider_network_blocked", probe)
        self.assertIn("PostgresPreviewRepository", probe)
        self.assertIn("previewReadRoutes", probe)
        self.assertIn("provider_calls:0", probe)

    def test_runtime_probe_binds_certification_runner_to_each_selected_runtime(self):
        probe = RUNTIME_PROBE.read_text(encoding="utf-8")
        self.assertIn("certification.Image!==expectedRuntime.api.config_digest", probe)
        self.assertNotIn("certification.Image!==releases.n_plus_1.api.config_digest", probe)

    def test_prospective_baseline_is_captured_from_inspected_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output = run_baseline_probe(directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            baseline = json.loads(output.read_text(encoding="utf-8"))
            self.assertTrue(baseline["prospective_certification_baseline"])
            self.assertFalse(baseline["historical_pre_existing_release"])
            self.assertEqual(baseline["release"]["api"]["executable_identity"]["runtime_ref"], snapshot()["releases"]["n"]["api"]["runtime_ref"])
            self.assertEqual(baseline["runtime_safety"]["worker_state"], "stopped")
            self.assertFalse(baseline["runtime_safety"]["championship_execution_enabled"])
            self.assertEqual(baseline["database_integrity"]["classification"], "aggregate-integrity-anchor")
            self.assertTrue(baseline["database_integrity"]["continuity_requires_independent_checks"])

    def test_preflight_refuses_invalid_or_reclassified_prospective_baseline(self):
        mutations = (
            lambda value: value.update(prospective_certification_baseline=False),
            lambda value: value["provenance"].update(source="operator-declaration"),
            lambda value: value["release"]["api"]["executable_identity"].update(config_digest="sha256:" + "9" * 64),
            lambda value: value["release"]["web"]["executable_identity"].update(runtime_manifest_digest="sha256:" + "9" * 64),
            lambda value: value["release"]["api"]["oci_provenance"].update(historical_index_digest="unknown"),
            lambda value: value.update(classification="historical-release", historical_pre_existing_release=True),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                baseline = baseline_artifact(); mutate(baseline)
                self.assertNotEqual(run_preflight(snapshot(), baseline).returncode, 0)

    def test_runtime_identity_accepts_missing_attestation_and_changed_oci_locator(self):
        baseline = baseline_artifact()
        baseline["release"]["web"]["oci_provenance"].update(attestation_digest="sha256:" + "8" * 64, attestation_blob_available=False)
        value = snapshot()
        value["releases"]["n"]["web"]["runtime_ref"] = "mirror.example/historical-web@" + value["releases"]["n"]["web"]["runtime_manifest_digest"]
        self.assertEqual(run_preflight(value, baseline).returncode, 0)

    def test_runtime_identity_refuses_manifest_config_and_rootfs_differences(self):
        mutations = (
            lambda value: value["releases"]["n"]["web"].update(runtime_manifest_digest="sha256:" + "9" * 64, runtime_ref="registry.example/release-n-web@sha256:" + "9" * 64),
            lambda value: value["releases"]["n"]["web"].update(config_digest="sha256:" + "9" * 64),
            lambda value: value["releases"]["n"]["web"].update(rootfs_diff_ids=["sha256:" + "9" * 64]),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                value = snapshot(); mutate(value)
                self.assertNotEqual(run_preflight(value).returncode, 0)

    def test_runtime_identity_refuses_same_git_metadata_with_different_runtime(self):
        value = snapshot()
        value["releases"]["n"]["api"].update(runtime_manifest_digest="sha256:" + "9" * 64, runtime_ref="registry.example/release-n-api@sha256:" + "9" * 64)
        self.assertNotEqual(run_preflight(value).returncode, 0)

    def test_v1_baseline_and_incomplete_v2_are_fail_closed(self):
        v1 = baseline_artifact(); v1["schema"] = "lot57pf3-prospective-baseline-v1"
        incomplete = baseline_artifact(); incomplete["runtime_identity_complete"] = False
        for baseline in (v1, incomplete):
            self.assertNotEqual(run_preflight(snapshot(), baseline).returncode, 0)

    def test_preflight_refuses_different_commit_with_identical_git_tree(self):
        value = snapshot()
        value["releases"]["n_plus_1"]["api"]["git_tree"] = value["releases"]["n"]["api"]["git_tree"]
        value["releases"]["n_plus_1"]["web"]["git_tree"] = value["releases"]["n"]["web"]["git_tree"]
        self.assertNotEqual(run_preflight(value).returncode, 0)

    def test_preflight_refuses_api_web_release_incoherence(self):
        for field, value in (("git_sha", "9" * 40), ("version", "9.9.9"), ("git_tree", "9" * 40)):
            with self.subTest(field=field):
                data = snapshot()
                data["releases"]["n_plus_1"]["web"][field] = value
                self.assertNotEqual(run_preflight(data).returncode, 0)

    def test_championship_execution_is_preserved_and_fail_closed(self):
        self.assertNotEqual(run_preflight(snapshot(championship_execution_enabled=True)).returncode, 0)
        baseline = baseline_artifact()
        baseline["runtime_safety"]["championship_execution_enabled"] = True
        self.assertNotEqual(run_preflight(snapshot(), baseline).returncode, 0)

    def test_prospective_baseline_refuses_worker_image_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output = run_baseline_probe(directory, "baseline-runtime-worker-wrong")
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())

    def test_preflight_accepts_only_complete_sanitized_safe_state(self):
        result = run_preflight(snapshot())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["provider_calls"], 0)

    def test_preflight_fails_closed_for_every_operational_guard(self):
        unsafe = {
            "worker_running": True,
            "provider_execution_enabled": True,
            "scheduler_enabled": True,
            "discovery_enabled": True,
            "provider_network_blocked": False,
            "preview_production_enabled": True,
            "production_target": True,
        }
        for field, value in unsafe.items():
            with self.subTest(field=field):
                result = run_preflight(snapshot(**{field: value}))
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("preflight refused", result.stderr.lower())

    def test_preflight_rejects_unknown_or_mutable_release_identity(self):
        for release, component, field, value in [("n", "api", "git_sha", "unknown"), ("n_plus_1", "web", "build_time", "unknown"), ("n", "web", "runtime_manifest_digest", "latest")]:
            with self.subTest(release=release, component=component, field=field):
                data = snapshot()
                data["releases"][release][component][field] = value
                self.assertNotEqual(run_preflight(data).returncode, 0)

    def test_rollback_tool_is_non_executable_and_preserves_forward_schema(self):
        script = (ROOT / "scripts" / "lot57pf3-release-rollback.sh").read_text(encoding="utf-8")
        self.assertIn('"${1:-}" != "--print-procedure"', script)
        self.assertIn("docker compose up -d --no-build", script)
        self.assertIn("Do not run DOWN migrations", script)
        self.assertIn("do not reset the database", script)
        self.assertIn("do not restore the backup", script)
        self.assertIn("separate disposable database", script)
        self.assertIn("dynamic migration head", script)
        self.assertIn("capture-lot57pf3-runtime-snapshot.mjs", script)
        self.assertIn("Manually authored safety snapshots are forbidden", script)
        for identity in ("N API", "N Web", "N+1 API", "N+1 Web"):
            self.assertIn(identity, script)

    def test_operational_harness_blocks_network_and_keeps_fixtures_isolated(self):
        validator = (ROOT / "scripts" / "validate-lot57pf3-operational-closure.mjs").read_text(encoding="utf-8")
        wrapper = (ROOT / "scripts" / "test-lot57pf3-operational-closure.sh").read_text(encoding="utf-8")
        self.assertIn("external_provider_network_blocked", validator)
        self.assertIn("globalThis.fetch", validator)
        self.assertIn("assert.equal(blockedNetworkAttempts,1)", validator)
        self.assertNotIn("let providerCalls", validator)
        self.assertIn("provider_calls:0", validator)
        self.assertIn("docker compose up -d --wait postgres", wrapper)
        self.assertNotIn("worker", wrapper)
        self.assertIn("PROVIDER_CALLS=0", wrapper)

    def test_evidence_builder_outputs_only_sanitized_operational_fields(self):
        raw = evidence_input()
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "raw.json", Path(directory) / "evidence.json"
            source.write_text(json.dumps(raw), encoding="utf-8")
            result = subprocess.run(["node", str(EVIDENCE), str(source), str(output)], cwd=ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            evidence = json.loads(output.read_text(encoding="utf-8"))
            self.assertTrue(evidence["sanitized"])
            self.assertEqual(evidence["provider_calls"], 0)
            self.assertEqual(evidence["provider_credits"], 0)
            self.assertEqual(evidence["incremental_change"]["changed_fields"], ["name", "startsAt"])
            self.assertEqual(set(evidence["release"]["n"]), {"api", "web"})
            self.assertEqual(set(evidence["release"]["n_plus_1"]), {"api", "web"})

    def test_evidence_builder_rejects_unexpected_sensitive_or_payload_fields(self):
        for field in ("credential", "secret", "ciphertext", "nonce", "provider_payload", "source_payload"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                source, output = Path(directory) / "raw.json", Path(directory) / "evidence.json"
                source.write_text(json.dumps({field: "must-not-pass"}), encoding="utf-8")
                result = subprocess.run(["node", str(EVIDENCE), str(source), str(output)], cwd=ROOT, text=True, capture_output=True, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_evidence_builder_refuses_every_false_success_condition(self):
        mutations = (
            lambda value: value["comparisons"].update(event_uuid_stable=False),
            lambda value: value["checks"].update(tls=False),
            lambda value: value["backup_restore"].update(restore_integrity_match=False),
            lambda value: value["incremental_change"].update(starts_at_source_b=False),
            lambda value: value["incremental_change"].update(name_override_preserved=False),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as directory:
                raw, source, output = evidence_input(), Path(directory) / "raw.json", Path(directory) / "evidence.json"
                mutate(raw)
                source.write_text(json.dumps(raw), encoding="utf-8")
                result = subprocess.run(["node", str(EVIDENCE), str(source), str(output)], cwd=ROOT, text=True, capture_output=True, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_evidence_builder_independently_refuses_invalid_final_invariants(self):
        mutations = (
            lambda value: value.update(provider_calls=1),
            lambda value: value.update(worker_state="running"),
            lambda value: value["release"]["n"]["api"].update(git_sha="ABC"),
            lambda value: value["release"]["n"]["web"].update(runtime_manifest_digest="latest"),
            lambda value: value["release"]["n_plus_1"]["api"].update(runtime_manifest_digest=value["release"]["n"]["api"]["runtime_manifest_digest"]),
            lambda value: value["release"]["n_plus_1"]["web"].update(runtime_manifest_digest=value["release"]["n"]["web"]["runtime_manifest_digest"]),
            lambda value: value["release"]["n_plus_1"]["web"].update(config_digest="unknown"),
            lambda value: value["release"]["n"]["web"].update(build_time="unknown"),
            lambda value: value["release"]["n_plus_1"]["api"].update(git_tree=value["release"]["n"]["api"]["git_tree"]),
            lambda value: value["release"]["n_plus_1"]["web"].update(git_tree=value["release"]["n"]["web"]["git_tree"]),
            lambda value: value["prospective_baseline"]["database_integrity"].update(classification="full-database-fingerprint"),
            lambda value: value["prospective_baseline"]["database_integrity"].update(continuity_requires_independent_checks=False),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index), tempfile.TemporaryDirectory() as directory:
                raw, source, output = evidence_input(), Path(directory) / "raw.json", Path(directory) / "evidence.json"
                mutate(raw)
                source.write_text(json.dumps(raw), encoding="utf-8")
                result = subprocess.run(["node", str(EVIDENCE), str(source), str(output)], cwd=ROOT, text=True, capture_output=True, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_runtime_probe_derives_safe_snapshot_from_inspected_state(self):
        with tempfile.TemporaryDirectory() as directory:
            result, output = run_runtime_probe(directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            snapshot_value = json.loads(output.read_text(encoding="utf-8"))
            self.assertTrue(snapshot_value["provider_network_blocked"])
            self.assertEqual(snapshot_value["provider_network_block_mechanism"], "container-egress-deny")
            self.assertEqual(run_preflight(snapshot_value).returncode, 0)

    def test_runtime_probe_refuses_unverifiable_network_and_running_worker(self):
        for mode in ("network-open", "network-unknown", "worker", "unknown", "runner-stopped"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                result, output = run_runtime_probe(directory, mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_runtime_probe_requires_exclusive_internal_runner_network(self):
        for mode in ("network-multi", "network-ordinary", "network-empty"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                result, output = run_runtime_probe(directory, mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_runtime_probe_refuses_production_or_preview(self):
        for mode in ("production", "preview"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                result, output = run_runtime_probe(directory, mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_runtime_probe_refuses_wrong_api_web_or_worker_runtime_image(self):
        for mode in ("runtime-api-wrong", "runtime-web-wrong", "runtime-worker-wrong", "web-metadata-unknown"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                result, output = run_runtime_probe(directory, mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_manual_boolean_snapshot_is_not_an_operational_probe_input(self):
        with tempfile.TemporaryDirectory() as directory:
            manual = Path(directory) / "manual.json"
            manual.write_text(json.dumps(snapshot()), encoding="utf-8")
            result = subprocess.run(["node", str(RUNTIME_PROBE), "--snapshot", str(manual)], cwd=ROOT, text=True, capture_output=True, check=False)
            self.assertNotEqual(result.returncode, 0)
