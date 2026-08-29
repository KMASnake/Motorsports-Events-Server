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
