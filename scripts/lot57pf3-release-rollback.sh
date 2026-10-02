#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--print-procedure" ]]; then
  echo 'Refused: this repository tool only prints the maintainer-reviewed VPS procedure.' >&2
  echo 'Usage: scripts/lot57pf3-release-rollback.sh --print-procedure' >&2
  exit 1
fi

cat <<'PROCEDURE'
F3 prospective baseline N, then N -> N+1 -> N -> N+1 procedure (NOT an execution script)

Phase 1 — establish prospective certification baseline N:
1. Build and actually deploy one complete, immutable API+Web release in preproduction.
2. Recreate the stopped worker container from the exact N API image without starting it.
3. Run capture-lot57pf3-prospective-baseline.mjs with the exact N API/Web digest references.
4. Retain the generated prospective baseline artifact and both N images. It is not a historical/pre-existing release claim.
5. PP-T38 and PP-178 remain NOT PROVEN after Phase 1.

Phase 2 preconditions, only after a genuinely distinct authorized N+1 exists:
1. Create the runtime snapshot only with capture-lot57pf3-runtime-snapshot.mjs, using immutable API and Web digest references for N and N+1.
   Manually authored safety snapshots are forbidden in the operational path.
2. Pass that generated snapshot and the retained prospective baseline N artifact to validate-lot57pf3-preflight.mjs.
3. Pin N API, N Web, N+1 API and N+1 Web independently by version, Git SHA, build time, image ID and sha256 digest.
4. Confirm worker/scheduler/discovery stopped, providers non-executable, Preview Production OFF,
   provider egress denied by firewall/container policy, and target is preproduction only.
5. Run certification workloads only on the inspected Docker network mse-f3-certification-internal,
   from the disposable mse-f3-certification-runner container. Give it only that network,
   labels com.mse.certification=lot57pf3 and com.mse.certification.target=preproduction,
   and the exact inspected N+1 image. The probe refuses every additional network attachment.
6. Record the dynamic migration head from schema_migrations; never hardcode a version.
7. Create a backup and restore it into a separate disposable database; compare integrity fingerprints.
8. Derive each commit's Git tree with git rev-parse <sha>^{tree}; refuse N+1 when its tree equals N,
   including empty commits and builds differing only through BUILD_TIME or image metadata.
9. Treat the Phase 1 database digest only as an aggregate integrity anchor. Verify UUID, revisions,
   sequences, cursors and relationship integrity independently throughout Phase 2.

Normative PP-T36/PP-174 incremental evidence for this fixture:
- exactly one updated change after cursor A;
- changed_fields exactly ['name','startsAt'];
- startsAt equals source cycle B;
- name equals the preserved administrative override.

Phase 2 execution after separate VPS authorization only:
1. Start exact N API + exact N Web images with docker compose up -d --no-build; verify runtime image IDs, health/CORS/TLS/metrics and cursor continuity.
2. Record UUID/revision/sequence/cursor and integrity fingerprints.
3. Start exact N+1 API + exact N+1 Web images with docker compose up -d --no-build; verify both runtime image IDs, run only forward migrations, and certify F3 cycles.
4. Record the new dynamic migration head and compare UUID/revision/sequence/cursor.
5. Roll back the application to exact N API + exact N Web images with docker compose up -d --no-build and verify both runtime image IDs.
6. Do not run DOWN migrations, do not reset the database, and do not restore the backup.
7. Fail certification if N cannot start and serve both pre-N+1 and post-N+1 cursors against the N+1 schema.
8. Re-deploy exact N+1 API + exact N+1 Web images with docker compose up -d --no-build only after rollback certification passes; verify both final runtime image IDs.
9. Re-run health/CORS/TLS/metrics and integrity checks; retain sanitized evidence and dispose of the restore DB.
10. PP-T38 and PP-178 become provable only if this complete Phase 2 succeeds.

Restore is an emergency protection only, never the normal application rollback mechanism.
PROCEDURE
