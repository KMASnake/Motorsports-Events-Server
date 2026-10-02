# CLEANUP-08 — Root legacy files audit

Date: 2026-08-25
Branch: `cleanup/architecture-state-model`
Baseline: `8a603232bfec44711cfac382e4f73687dd370e53`

## Goal

Reduce root-level noise without removing anything still required by the active Node target, the frozen Python production rollback path, CI, release, or upgrade tooling.

## Removed

### `GIT_COMMIT`

Contained only the stale marker `archive-build`. No active consumer was identified. Git itself and release metadata already provide the authoritative commit SHA.

### `MILESTONE`

Contained only `4.17-stable-release`. It was not read by the release or repository validation scripts. Its only active effect was to trigger the legacy Python workflow when modified; that path trigger was removed together with the file.

### `PROJECT`

Contained only `motorsports-events-server`. It duplicated the repository/package identity and had no active consumer.

### `TESTING.md`

Described a Lot 4 manual smoke procedure for `v8.1.0-alpha.2-lot.4`. Current validation is defined by the Node CI, package scripts, provider certifications, and handoff documentation.

### `Makefile`

Contained only thin aliases around `npm` and `docker compose` commands. No repository documentation, CI workflow, Compose file, or package script depended on it. The canonical commands remain in `package.json` and Docker Compose.

## Kept

### `VERSION`

Active legacy release/upgrade contract. It is read by `scripts/build-release.sh`, `scripts/preflight-upgrade.sh`, `scripts/upgrade.sh`, repository validation, and the legacy release workflow. Do not remove or consolidate before a dedicated release-version cleanup.

### `BASELINE.json`

Kept while the Python production generation remains frozen but rollback-capable. It documents the historical production baseline and should be removed only with the legacy backend cutover cleanup.

### `.coveragerc`

Legacy Python CI still measures coverage for `server/app/providers`; this file is therefore part of the frozen production validation path.

### `pytest.ini`

Still configures the PostgreSQL marker used by the Python legacy integration tests.

### `Caddyfile`, `install.sh`, root operational wrappers

Classified in CLEANUP-06 as frozen legacy operations. They remain until Production Node cutover and rollback certification.

## CI change

`.github/workflows/validate.yml` no longer includes `MILESTONE` in its path filters. No job command or validation behavior was otherwise changed by CLEANUP-08.

## Result

The root now contains fewer historical marker files while preserving:

- Node target build/test/runtime inputs;
- Python legacy CI and rollback inputs;
- current release/upgrade version contract;
- provider certification assets;
- migrations and operational safety tooling.

No API, provider, database migration, acquisition, normalization, publication, or frontend runtime code was modified in CLEANUP-08.
