from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/test-f4-empty-event-database.sh"
DOC = ROOT / "docs/handoff/LOT-5.7-P-F4-EMPTY-EVENT-BASELINE.md"


class EmptyEventDatabaseContractTests(unittest.TestCase):
    def test_recipe_is_isolated_and_fail_closed(self) -> None:
        text = SCRIPT.read_text()
        self.assertIn("mktemp -d /tmp/mse-f4-empty-event-db.", text)
        self.assertIn("created-by-f4-empty-event-db", text)
        self.assertIn("mse_f4_empty_", text)
        self.assertIn("Refusing protected database name", text)
        self.assertIn("select count(*) from pg_database", text)
        self.assertIn('rm -rf -- "${TMP_ROOT}"', text)
        self.assertIn('if [[ "${cleanup_safe}" == true ]]', text)
        self.assertIn('"${PG_CTL}" -D "${CLUSTER_DIR}" -m fast -w stop', text)
        self.assertNotIn("docker compose", text.lower())
        self.assertIsNone(re.search(r"docker\s+(?:system|image|volume)\s+prune", text, re.I))
        self.assertNotIn("DATABASE_URL:-", text)
        self.assertIn("unset DATABASE_URL PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE", text)
        self.assertIn("unset PGSERVICE PGSERVICEFILE PGOPTIONS COMPOSE_FILE COMPOSE_PROJECT_NAME", text)
        self.assertIsNone(re.search(r"\b(?:delete\s+from|truncate|drop\s+database)\b", text, re.I))

    def test_recipe_applies_canonical_schema_and_checks_calendar(self) -> None:
        text = SCRIPT.read_text()
        self.assertIn("infra/postgres/init/001-bootstrap.sql", text)
        self.assertIn("infra/postgres/migrations/migrate.sh", text)
        self.assertIn("0031_real_circuit_reference_data", text)
        self.assertIn("select count(*) from schema_migrations')\" == 31", text)
        self.assertIn('"${ROOT}/apps/api/src/server.ts"', text)
        self.assertIn("/health/ready", text)
        self.assertIn('v.readiness!=="compatible"', text)
        self.assertIn("/api/v1/events", text)
        self.assertIn("v.length!==0", text)
        self.assertIn("PREVIEW_API_ENABLED=false", text)
        self.assertIn("API_HOST=127.0.0.1", text)
        self.assertIn("process.env.API_HOST ?? '0.0.0.0'", (ROOT / "apps/api/src/server.ts").read_text())

    def test_docker_fallback_is_owned_local_and_ephemeral(self) -> None:
        text = SCRIPT.read_text()
        self.assertIn("POSTGRES_IMAGE=postgres:16.10-bookworm", text)
        self.assertIn("Docker fallback refuses inherited DOCKER_HOST/DOCKER_CONTEXT", text)
        self.assertIn('[[ "${context}" == default ]]', text)
        self.assertIn('[[ "${endpoint}" == unix://* ]]', text)
        self.assertIn("docker network create --internal --label", text)
        self.assertIn('--label "${OWNERSHIP_LABEL}=${RUN_ID}"', text)
        self.assertIn("--tmpfs /var/lib/postgresql/data", text)
        self.assertNotIn("docker volume", text)
        self.assertIn('--publish "127.0.0.1:${PG_PORT}:5432/tcp"', text)
        self.assertNotIn("127.0.0.1::5432", text)
        self.assertNotIn(".Config.ExposedPorts", text)
        self.assertIn("{{ json .HostConfig.PortBindings }}", text)
        self.assertNotIn("{{ json .NetworkSettings.Ports }}", text)
        self.assertIn('keys.length===1 && keys[0]==="5432/tcp"', text)
        self.assertIn('bindings.length===1', text)
        self.assertIn('bindings[0]?.HostIp==="127.0.0.1"', text)
        self.assertIn('bindings[0]?.HostPort===expectedPort', text)
        self.assertIn("expected only 127.0.0.1:${expectedPort}->5432/tcp", text)
        self.assertIn('docker port "${DOCKER_CONTAINER}" 5432/tcp', text)
        self.assertIn('if [[ "${port_binding}" != "127.0.0.1:${PG_PORT}" ]]', text)
        self.assertIn("owned_container", text)
        self.assertIn("owned_network", text)

    def test_port_proofs_reject_unsafe_or_ambiguous_bindings(self) -> None:
        text = SCRIPT.read_text()
        # The pre-start proof rejects missing/extra container ports, multiple
        # bindings, every non-loopback address and every unexpected host port.
        self.assertIn('keys.length===1 && keys[0]==="5432/tcp"', text)
        self.assertIn('Array.isArray(bindings) && bindings.length===1', text)
        self.assertIn('bindings[0]?.HostIp==="127.0.0.1"', text)
        self.assertIn('bindings[0]?.HostPort===expectedPort', text)
        self.assertNotIn('HostIp==="0.0.0.0"', text)
        self.assertNotIn('HostIp==="::"', text)
        # Exact whole-output comparison rejects empty output, a wrong address
        # or port, and multiple newline-separated docker-port bindings.
        self.assertIn('if [[ "${port_binding}" != "127.0.0.1:${PG_PORT}" ]]', text)
        self.assertIn("expected one line exactly equal", text)

    def test_docker_cleanup_cannot_target_foreign_resources(self) -> None:
        text = SCRIPT.read_text()
        self.assertIn("cleanup refused unproven container ownership", text)
        self.assertIn("cleanup refused unproven network ownership", text)
        self.assertIn('docker rm --force "${DOCKER_CONTAINER}"', text)
        self.assertIn('docker network rm "${DOCKER_NETWORK}"', text)
        self.assertNotIn("docker container prune", text)
        self.assertNotIn("docker network prune", text)

    def test_empty_contract_covers_transactional_event_and_provider_tables(self) -> None:
        text = SCRIPT.read_text()
        required = {
            "events", "meetings", "meeting_events", "sessions",
            "event_source_links", "meeting_source_links", "normalized_candidates",
            "provider_source_entities", "provider_acquisition_traversals",
            "sync_streams", "sync_runs", "public_resource_states", "public_change_log",
        }
        for table in required:
            self.assertIn(f"'{table}'", text)
        for reference in ("championships", "circuits", "session_types"):
            self.assertIn(f"select count(*) from {reference}", text)

    def test_handoff_defines_provider_first_and_results_ready_boundaries(self) -> None:
        text = DOC.read_text()
        self.assertIn("Providers → Motorsports-Events → API Motorsports-Events → MyBB / Android / Apple", text)
        self.assertIn("RESULTS_READY=PARTIAL", text)
        self.assertIn("PROVIDER_FIRST_READY=PARTIAL", text)
        self.assertIn("0031_real_circuit_reference_data", text)
        self.assertIn("F5 n’est ni commencé ni autorisé", text)
        self.assertIn("Event-as-Session", text)


if __name__ == "__main__":
    unittest.main()
