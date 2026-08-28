import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PREFLIGHT = ROOT / "scripts" / "validate-lot57pf3-preflight.mjs"
EVIDENCE = ROOT / "scripts" / "build-lot57pf3-evidence.mjs"
RUNTIME_PROBE = ROOT / "scripts" / "capture-lot57pf3-runtime-snapshot.mjs"


def snapshot(**overrides):
    def image(version, sha_digit, id_digit, digest_digit, hour):
        return {"version": version, "git_sha": sha_digit * 40, "build_time": f"2026-08-28T{hour}:00:00Z", "image_id": "sha256:" + id_digit * 64, "image_digest": "sha256:" + digest_digit * 64}
    value = {
        "worker_running": False,
        "provider_execution_enabled": False,
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


def run_preflight(value):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "snapshot.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return subprocess.run(["node", str(PREFLIGHT), str(path)], cwd=ROOT, text=True, capture_output=True, check=False)


def fake_docker(directory, mode="safe"):
    executable = Path(directory) / "docker"
    executable.write_text("""#!/usr/bin/env python3
import json,os,sys
a=sys.argv[1:];mode=os.environ.get('F3_FAKE_MODE','safe')
if a[0]=='compose' and 'ps' in a:
    service=a[-1];print({'postgres':'postgres-id','api':'api-id','web':'web-id','worker':'worker-id'}[service]);sys.exit(0)
if a[0]=='compose' and 'exec' in a:
    state={'provider_execution_enabled':False,'championship_execution_enabled':False,'scheduler_execution_active':False,'discovery_enabled':False}
    if mode=='provider':state['provider_execution_enabled']=True
    if mode=='unknown':sys.exit(2)
    print(json.dumps(state));sys.exit(0)
if a[0]=='inspect':
    name=a[1];running=name!='worker-id' or mode=='worker';project='production' if mode=='production' else 'mse-preprod'
    env=['POSTGRES_USER=mse','POSTGRES_DB=motorsports_events'] if name=='postgres-id' else ['NODE_ENV=production','PREVIEW_API_ENABLED='+('true' if mode=='preview' else 'false')]
    networks={'mse-f3-certification-internal':{}}
    labels={'com.docker.compose.project':project}
    image='sha256:'+('d' if name=='web-id' else 'c')*64
    if mode=='runtime-api-wrong' and name=='api-id':image='sha256:'+'a'*64
    if mode=='runtime-web-wrong' and name=='web-id':image='sha256:'+'b'*64
    if mode=='runtime-worker-wrong' and name=='worker-id':image='sha256:'+'a'*64
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
    print(json.dumps([{'Id':'sha256:'+image_digit*64,'RepoDigests':[ref],'Config':{'Env':metadata}}]));sys.exit(0)
sys.exit(3)
""", encoding="utf-8")
    executable.chmod(0o755)
    return executable


def run_runtime_probe(tmp_path, mode="safe", extra_args=()):
    fake_docker(tmp_path, mode)
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


def evidence_input():
    return {
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


class Lot57Pf3ToolingTests(unittest.TestCase):
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
        for release, component, field, value in [("n", "api", "git_sha", "unknown"), ("n_plus_1", "web", "build_time", "unknown"), ("n", "web", "image_digest", "latest")]:
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
            lambda value: value["release"]["n"]["web"].update(image_digest="latest"),
            lambda value: value["release"]["n_plus_1"]["api"].update(image_digest=value["release"]["n"]["api"]["image_digest"]),
            lambda value: value["release"]["n_plus_1"]["web"].update(image_digest=value["release"]["n"]["web"]["image_digest"]),
            lambda value: value["release"]["n_plus_1"]["web"].update(image_id="unknown"),
            lambda value: value["release"]["n"]["web"].update(build_time="unknown"),
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
