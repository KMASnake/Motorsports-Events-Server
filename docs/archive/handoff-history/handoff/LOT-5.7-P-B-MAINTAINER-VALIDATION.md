# Lot 5.7-P-B — maintainer validation and next-gate authorization

Date: 2026-08-22

## Maintainer decision

5.7-P-B — Deterministic normalization and source mapping:

- maintainer audit: **PASS**;
- maintainer validated: **TRUE**;
- Acceptance: **45 PASS / 0 PARTIAL / 0 FAIL / 0 NOT TESTED**;
- PP-T07 through PP-T16: **PASS**;
- targeted tests: **37/37 PASS**.

Validated baselines: API 250/250, Web 42/42, security 52/52, non-regression A
and 5.6 PASS, scheduler 5.4 PASS and quota/cadence 5.5 61 cases PASS. Real
provider requests and provider credits remain 0.

The inherited 5.6-G P3 remains non-blocking and unchanged: an invalid anomaly
query returns `[]` instead of HTTP 400. It does not reopen 5.6, A or B and is
not a prerequisite for C.

## Only authorized technical gate

5.7-P-C — Publication state, last-known-good and change log:

- **AUTHORIZED FOR IMPLEMENTATION**;
- **NOT STARTED**;
- Acceptance: PP-T17 through PP-T22 and relevant functional PP-062 through
  PP-073 plus PP-086 through PP-104.

The future C implementation may atomically promote reliable B candidates into
durable internal public state, preserve last-known-good, apply granular
blocking, increment resource revisions, append a monotone internal change log,
persist removal tombstones, enforce a non-destructive kill switch and prove
from-scratch/incremental rebuild convergence.

Its strict boundary is:

`5.6 source → B candidate → C quality gate → durable public state → change log`

It must stop before HTTP client routes, OpenAPI Preview exposure,
`/api/v1/changes`, API keys/auth/scopes/entitlements/limits, client ACP,
onboarding or launch.

5.7-P-D through F: **UNAUTHORIZED**.

Full Lot 5.7: **UNAUTHORIZED**.

Lots 5.8+: **UNAUTHORIZED**.

Merge to `main`: **UNAUTHORIZED**.

This decision changes governance only and implements no part of C.
