# F3 — Certified operational closure evidence

Maintainer validation: **PASS — 2026-09-21**.

This record preserves the maintainer-certified F3 result: **F3 COMPLETE / PROVEN**,
**PP-178 PROVEN** and **PP-T38 PROVEN**. Current authorization and next action
remain exclusively in [PROGRESS.json](PROGRESS.json). This evidence does not
close Gate F, complete F4, start F5, validate PP-179, authorize Production
Preview, external onboarding, full Lot 5.7, Lot 5.8+ or merge to main.

## Certified repository reference

- Branch: `codex/lot-5-providers-sync`.
- Git SHA: `e70f7e18e2ae01f4af8161577aaaefc834723cdb`.
- Git tree: `e8aafaf69076b0e38b7b78f3ca0c336f2b8d3998`.

These identify the certified F3 repository reference, not the later F4-0
documentation commit. They do not replace the distinct N/N+1 image identities
retained in the certification evidence.

## Evidence inventory and provenance

### Versioned prospective baseline N

- File: [lot57pf3-prospective-baseline-N.json](evidence/lot57pf3-prospective-baseline-N.json).
- SHA-256: `75dd9583fa3dc83b7c902028e7ad2b0f7abf17f1ce023ea8c151a93ebd3cfbd9`.
- The checksum was verified locally during F4-0; the artifact was not modified.
- N is an established **prospective certification baseline**, never a claim
  that this complete release was historically deployed before establishment.
- Historical OCI provenance, recovery locator and executable identity remain
  distinct under the [baseline contract](LOT-5.7-P-F3-PROSPECTIVE-BASELINE.md).

### Historical N identity evidence

- SHA-256 supplied by the maintainer:
  `208b80bfcef35c36efe5e5dcbf82d7bbba6feca1887c6286f8fc7fe18bafcf59`.
- This identifies the separately retained historical identity artifact. Its
  file path was not supplied with the F4-0 authorization; this record does not
  invent one or claim that the separate artifact is versioned in Git.
- Its bytes were not accessed or reconstructed during F4-0. The versioned
  baseline carries the retained identity chain used by certification.

### External final Phase 2 evidence

- Filename: `lot57pf3-phase2-evidence.json`.
- Location on the VPS at maintainer validation:
  `/home/debian/f3-phase2-evidence-20260921-143751/lot57pf3-phase2-evidence.json`.
- SHA-256: `4f7706f0d3f38eea74fcf8ffbb1dd60068d507a198d748789d8b6dd1f40cb5c1`.
- Generated artifact status: `eligible-for-maintainer-validation`.
- Subsequent maintainer decision: **PASS**, on **2026-09-21**.

The Phase 2 artifact is retained **outside Git**. Its provenance, validation
location, checksum and results were explicitly supplied by the maintainer.
F4-0 neither accesses the VPS nor independently rehashes, copies, fabricates or
reconstructs that artifact. The eligible status alone was not certification;
the explicit subsequent maintainer decision establishes the recorded proof.

## Executed and validated sequence

1. `n-pre-migration`: exact N before migration.
2. `n-post-forward-migration`: N remains usable against the forward schema.
3. `n-plus-one`: transition to N+1.
4. `rollback-n`: application rollback to retained N.
5. `final-n-plus-one`: return to certified N+1.

The approved Phase 2 evidence covers release identity, API usability and
UUID/revision/sequence/cursor/relationship continuity across this sequence.
The certification uses the immutable API and Web identities under the F3
contract; recovery locators do not rewrite historical OCI provenance.

## Final result and safety invariants

Maintainer-confirmed final state:

- Migration head: `0031_real_circuit_reference_data`.
- Runtime: **N+1**, API healthy, Web healthy, worker stopped.
- `provider_calls=0`, `provider_credits=0`, `worker_started=false`.
- No DOWN migration, database reset or database restore as normal rollback.
- Backup verified; restoration tested in a separate disposable database;
  restore integrity verified; cleanup verified.
- Production untouched; no Production Preview authorization is granted.

These describe the certified execution, not a new runtime check by F4-0.
Earlier NOT PROVEN statements remain historical evidence of the Phase 1 and
static-design stages and are superseded for PP-178/PP-T38 by this final result.
Other Gate F criteria are not implicitly validated.

## Retention pending a separate decision

Retain without rewriting or deletion:

- prospective baseline N and separate historical N identity artifact;
- final Phase 2 evidence and its checksum/provenance;
- OCI layouts/exports for N and N+1 required for audit and rollback;
- digests, executable identities and release metadata;
- F3 runner, capture tools, validators and fail-closed tests;
- artifacts necessary to trace the certification and its five states.

No registry, network, temporary VPS tooling or other F3 resource is removed by
F4-0. Any retention or cleanup action requires a separate maintainer decision.

## F4-0 boundary

F4 is in progress; only this documentation/handoff consolidation is authorized.
F4 is not complete and F5 is not started. No application, test, Compose,
Dockerfile, operating script, migration or CI change belongs to this lot.
No DB/runtime mutation, provider call, worker start, deployment or VPS access
was needed to record the supplied evidence. See PROGRESS.json for the current
scope and the required maintainer review after the single local commit.
