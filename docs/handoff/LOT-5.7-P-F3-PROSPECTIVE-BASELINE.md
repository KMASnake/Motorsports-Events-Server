# 5.7-P-F3 prospective certification baseline N

This contract resolves the absence of a certifiable historical API+Web release
without reconstructing or relabelling history. It authorizes no VPS action by
itself.

## Phase 1 — establish N prospectively

A release becomes baseline N only after its exact API and Web images are
actually deployed in preproduction and inspected by
`capture-lot57pf3-prospective-baseline.mjs`. The generated artifact is marked
`prospective-certification-baseline`; it must never be described as a
historical or pre-existing deployment.

The probe records the establishment time, common Git commit, repository-derived
Git tree SHA and semantic version,
immutable API/Web references, image IDs/digests and embedded release metadata,
the dynamic migration head, an explicitly classified aggregate integrity
anchor, independent revision/change sequence/checkpoint anchors, and
fail-closed runtime safety state. The aggregate anchor is not a full database
fingerprint and its equality alone never proves continuity. UUID, revisions,
sequences, cursors and relationship integrity remain separate mandatory Phase
2 checks. The API and
Web must use the inspected images. The stopped worker must identify the exact
API image and must not be started.

Phase 1 does not test release rollback:

- PP-T38 remains **NOT PROVEN**;
- PP-178 remains **NOT PROVEN**.

Both N images and the sanitized baseline artifact must be retained unchanged.

## Phase 2 — certify a genuinely distinct N+1

Phase 2 may begin only after a separately authorized N+1 contains meaningful
Git tree distinct from N. Tree identity is derived fail-closed with
`git rev-parse <commit>^{tree}` from the trusted repository object database,
never accepted as an operator declaration. A different commit pointing to the
same tree, changing only `BUILD_TIME`, rebuilding the same Git tree, changing a
mutable tag, or changing `VERSION` solely to manufacture N+1 is refused.

The runtime snapshot and final evidence import the Phase 1 artifact. N's API
and Web immutable references, metadata, image IDs and digests must match it
exactly. The procedure is:

1. exact N API + Web;
2. exact N+1 API + Web;
3. exact N API + Web with `--no-build`, no DOWN migration and no database reset;
4. final exact N+1 API + Web.

Every transition verifies runtime image identity, health, TLS, CORS, metrics,
database integrity and UUID/revision/sequence/cursor continuity. PP-T38 and
PP-178 may pass only after the complete Phase 2 succeeds. Provider calls,
provider credits, worker starts, Production Preview and Production mutations
remain forbidden by the F3 safety contract.

## Dedicated Phase 2 runner

`scripts/run-lot57pf3-phase2.sh` is the only repository runner prepared for the
preproduction release sequence. It is not authorized for execution by this
document and is deliberately distinct from the local deterministic
`test-lot57pf3-operational-closure.sh` harness.

Before any release mutation it requires explicit execution authorization,
proves that the runtime is exact baseline N through the repository-controlled
snapshot and preflight, verifies all execution-disable guards and exclusive
internal certification networking, captures dynamic DB/cursor anchors, and
verifies a safety backup in a distinct disposable restore database. The restore
is never used as the normal rollback path.

The runner records five explicit evidence states: `N_PRE_MIGRATION`,
`N_POST_FORWARD_MIGRATION`, `N_PLUS_1`, `ROLLBACK_N` and
`FINAL_N_PLUS_1`. It first proves N before migration, applies the forward
migration while N remains active, then proves that the same N is still
healthy/ready, readable, cursor-compatible and DB-integrity-compatible against
the new schema. Only then may it perform N API+Web → N+1 API+Web → N
API+Web → final N+1 API+Web. Every application transition uses retained digest references with
`docker compose up -d --no-build`. It recreates the worker container from the
selected API image without starting it. Only the N→N+1 transition may execute
forward migrations. Rollback performs no DOWN migration, DB reset, restore,
Compose down, volume deletion or automatic recovery transition.

At every release state, inspected image identities, health/live/ready, TLS,
CORS, private metrics scraping, dynamic migration head, ordered UUID and
relationship anchors, revisions, sequences and cursor compatibility are
checked. Cursor probes run inside the exact selected API image on the exclusive
internal certification network with provider fetch disabled.

If a failure happens after a transition, the runner reports the exact last
runtime state and leaves it in place with the worker stopped. It never attempts
a destructive database rollback or silently moves to another release.

Final cleanup is fail-closed: the disposable restore database must be absent,
the certification runner must be absent, and no F3-labelled disposable
container may remain. Cleanup failure prevents generation of a successful
artifact. The strict final validator independently verifies the five-state
sequence, every state check, immutable release identity, continuity, backup,
zero-provider and stopped-worker invariants. Reaching the end of the shell does
not declare PP-178 PASS; the artifact is only eligible for a separate
maintainer validation and records `pp178_automatically_claimed_pass=false`.

At HEAD `441215841fe66d0b6b8e14bd565cf3d58492f908`, the proposed N+1 Git tree is
`7e0dfb7abf2fdd183bf7cdd35e2d0387e26a5581`, distinct from baseline N tree
`b98015daf2eac4b50b1939050056c979cdf0aa14`. This makes the current tree a
legitimate static N+1 candidate. It becomes an actual N+1 only after coordinated
API/Web images are built, carry matching SHA/tree/version metadata, receive
immutable digests and pass the inspected preflight. No image was built or
deployed during this static preparation.
