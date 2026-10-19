# Lot 5.7-P-A — maintainer validation and next-gate authorization

Date: 2026-08-22

## Maintainer decision

5.7-P-A — Normalized identity and persistence foundations:

- maintainer audit: **PASS**;
- maintainer validated: **TRUE**;
- Acceptance PP-T01 through PP-T06: **PASS**;
- dedicated recipe: **18/18 PASS**;
- P1: 0; functional P2: 0; evidence P2: 0; blocking P3: 0.

Validated non-regressions: API 213/213, Web 42/42, security 52/52,
acquisition 72/72, scheduler 5.4 PASS, quota/cadence 5.5 61 cases PASS and all
relevant 5.6 suites PASS. Real provider calls and provider credits remain 0.

The inherited 5.6-G P3 remains non-blocking and unchanged: an invalid anomaly
query returns `[]` instead of HTTP 400. It does not reopen 5.6 or 5.7-P-A and
is not a prerequisite for B.

## Only authorized technical gate

5.7-P-B — Deterministic normalization and source mapping:

- **AUTHORIZED FOR IMPLEMENTATION**;
- **NOT STARTED**;
- Acceptance: PP-T07 through PP-T16 and relevant functional PP-030 through
  PP-061 plus PP-181 through PP-183.

The future B implementation may deterministically transform private 5.6 source
envelopes into versioned candidates, reuse stable links, apply explicit
mappings/corrections, preserve provenance, resolve identity or review, and
advance a fenced checkpoint atomically. Its boundary is:

`5.6 source → mapper → identity resolver → normalized candidate → review / linked / create / rejected → checkpoint`

It must stop before public promotion, last-known-good, public state/change log,
Preview API, `/api/v1/changes`, client auth/keys/scopes/entitlements/limits,
client ACP, onboarding or launch.

5.7-P-C through F: **UNAUTHORIZED**.

Full Lot 5.7: **UNAUTHORIZED**.

Lots 5.8+: **UNAUTHORIZED**.

Merge to `main`: **UNAUTHORIZED**.

This decision changes governance only and implements no part of B.
