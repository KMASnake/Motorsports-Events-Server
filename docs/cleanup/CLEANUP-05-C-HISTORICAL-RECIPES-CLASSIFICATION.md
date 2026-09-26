# CLEANUP-05-C — Historical recipe classification

Date: 2026-08-25
Branch: `cleanup/architecture-state-model`
Baseline protected: `8a603232bfec44711cfac382e4f73687dd370e53`

## Goal

Classify the remaining historical test/acceptance recipes as `KEEP`, `ARCHIVE_DOC_ONLY`, or `DELETE`, based on active consumers and overlap with current Node CI / canonical shell recipes.

This cleanup does not change application runtime, provider runtime, PostgreSQL migrations, Docker services, or production/preproduction behavior.

## Classification rules

- `KEEP`: referenced by `package.json`, active CI, release/operations, or still provides canonical coverage not replaced elsewhere.
- `ARCHIVE_DOC_ONLY`: no active consumer; useful only as historical evidence. Remove from the active script tree and rely on Git history plus this classification note.
- `DELETE`: no active consumer and no unique current coverage; remove from the active script tree.

## Results

| Script | Classification | Rationale |
| --- | --- | --- |
| `scripts/test-lot1.ps1` | DELETE | Old live-stack smoke check for health, dashboard and frontend. No active consumer; superseded by current CI, API tests and later acceptance recipes. |
| `scripts/test-lot2.ps1` | DELETE | Same smoke pattern as Lot 1 with configurable ports. `package.json` uses `validate:lot2` → `validate-lot2.mjs`, not this PowerShell recipe. |
| `scripts/check-bootstrap.mjs` | DELETE | Static bootstrap-era existence check. No active consumer and it checks an early repository structure rather than current architecture. |
| `scripts/test-lot42-final.ps1` | ARCHIVE_DOC_ONLY | Historical Windows all-in-one Lot 4.2 acceptance recipe. No active consumer. Its functional pieces are now represented by current validators, migration tests, data tooling and Playwright coverage. |
| `scripts/test-lot43-final.ps1` | ARCHIVE_DOC_ONLY | Historical Windows Lot 4.3 acceptance recipe. No active consumer. Granular 4.3 migration/API/corrections/UI shell tests are the maintained callable paths. |
| `scripts/test-lot44-final.ps1` | ARCHIVE_DOC_ONLY | Historical Windows Lot 4.4 all-in-one recipe. No active consumer. The canonical maintained entry point is `scripts/test-lot44-final.sh`, exposed as `npm run test:lot44:final`, which composes foundation/API/UI auth tests. |
| `scripts/test-lot3.ps1` | KEEP | Explicitly referenced by `package.json` as `test:lot3`. |
| `scripts/test-lot4.ps1` | KEEP | Explicitly referenced by `package.json` as `test:lot4`. |
| `scripts/test-lot42-migrations.sh` | KEEP | Explicitly referenced by `package.json` as `test:migrations`. |
| `scripts/test-lot43-migrations.sh` | KEEP | Explicitly referenced by `package.json`. |
| `scripts/test-lot43-api.sh` | KEEP | Explicitly referenced by `package.json`. |
| `scripts/test-lot43-corrections.sh` | KEEP | Explicitly referenced by `package.json`. |
| `scripts/test-lot43-ui.sh` | KEEP | Explicitly referenced by `package.json`. |
| `scripts/test-lot44-auth-foundation.sh` | KEEP | Explicitly referenced by `package.json` and composed by `test-lot44-final.sh`. |
| `scripts/test-lot44-auth-api.sh` | KEEP | Explicitly referenced by `package.json` and composed by `test-lot44-final.sh`. |
| `scripts/test-lot44-auth-ui.sh` | KEEP | Explicitly referenced by `package.json` and composed by `test-lot44-final.sh`. |
| `scripts/test-lot44-final.sh` | KEEP | Explicitly referenced by `package.json` as the canonical Lot 4.4 final recipe. |
| `scripts/test-lot51-foundations.sh` | KEEP | Active npm test entry point. |
| `scripts/test-lot52-secrets.sh` | KEEP | Active npm test entry point. |
| `scripts/test-lot53-discovery.sh` | KEEP | Active npm test entry point. |
| `scripts/test-lot54-scheduler.sh` | KEEP | Active npm test entry point. |
| `scripts/test-lot55-quota-cadence.sh` | KEEP | Active npm test entry point and provider quota regression coverage. |
| `scripts/test-lot56-foundations.sh` | KEEP | Active npm test entry point. |
| `scripts/test-lot57p*.sh` and associated validators | KEEP | Current certification evidence for normalization, publication, provider acquisition, bounded runner and 5.7-P-F safety. Do not consolidate until the provider milestone is closed. |

## Coverage comparison

### Lot 1 / Lot 2 PowerShell smoke scripts

They only checked an already-running local stack:

- `docker compose ps`;
- API `/health`;
- `/api/v1/dashboard/summary`;
- frontend HTTP 200.

They were never canonical CI entry points. Keeping both creates duplicate historical smoke paths without protecting a current invariant.

### Lot 4.2 / 4.3 Windows final recipes

These were convenient all-in-one acceptance scripts for their milestones. Their constituent checks have since been split into maintained commands and later suites: Node lint/typecheck/test/build, migration checks, granular API/UI/corrections recipes, data tooling and Playwright.

Their historical value is preserved by Git history and this document; they no longer belong in the active executable surface.

### Lot 4.4 Windows final recipe

The repository already has a shell canonical equivalent, `scripts/test-lot44-final.sh`, referenced by `package.json`. It runs the local Node validation and composes `test-lot44-auth-foundation.sh`, `test-lot44-auth-api.sh` and `test-lot44-auth-ui.sh`.

The removed PowerShell version represented a parallel acceptance path and was not referenced by the active package scripts.

## Files removed in CLEANUP-05-C

- `scripts/test-lot1.ps1`
- `scripts/test-lot2.ps1`
- `scripts/check-bootstrap.mjs`
- `scripts/test-lot42-final.ps1`
- `scripts/test-lot43-final.ps1`
- `scripts/test-lot44-final.ps1`

## Safety boundary

Not changed:

- `package.json` active script mappings;
- `.github/workflows/**`;
- Compose files;
- release / backup / upgrade scripts;
- provider 5.x and 5.7-P-F certification scripts;
- API / web runtime code;
- migrations;
- Preview state;
- real provider execution.

CLEANUP-05-C result: completed conservatively.
