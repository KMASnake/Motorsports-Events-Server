# CLEANUP-07 — GitHub workflows and templates audit

Baseline cleanup branch: `cleanup/architecture-state-model`

## Goal

Clarify GitHub automation while preserving both the active Node target and the frozen Python production/rollback path until cutover.

## Workflows

### `.github/workflows/ci.yml`

Classification: **ACTIVE — NODE TARGET**.

This is the main Node/TypeScript validation path. It runs npm install/audit, typecheck, lint, tests, build, an isolated Docker stack, deterministic data, validation scripts and Playwright when relevant.

Action in CLEANUP-07: display name changed to `CI — Node target`. Behavior unchanged.

### `.github/workflows/docker.yml`

Classification: **ACTIVE — NODE TARGET / MANUAL**.

Manual Docker Compose config/build verification.

Action in CLEANUP-07: display name changed to `Docker build — Node target`. Behavior unchanged.

### `.github/workflows/validate.yml`

Classification: **FROZEN — LEGACY PYTHON PRODUCTION / RELEASE**.

The workflow is path-scoped to `server/**`, Python tests, the legacy release/validation scripts, `docker-compose.test.yml`, `VERSION` and `MILESTONE`. It remains required while the historical Python production and rollback/release chain still exist.

Action in CLEANUP-07: display name changed to `Validate legacy Python server`. Behavior unchanged.

Do not merge this workflow into the Node CI before the production cutover. Doing so would hide the fact that two generations are intentionally being validated for different purposes.

## Issue templates

### Kept

- `bug_report.yml`: generic server bug reporting.
- `handbook-change.md`: permanent architecture/Handbook changes.
- `ui-fidelity.md`: generic UI fidelity reports.

### Removed

The following templates were completed-lot execution artifacts and are not reusable issue types:

- `codex-lot-4-rev-1.md`
- `lot-4.2-calendar-interactive.md`
- `lot-4.2-complete.md`

Their history remains available in Git and the handover documentation.

## Pull request template

The PR checklist was aligned with the documentation hierarchy introduced by CLEANUP-04:

- `PROJECT-HANDBOOK.md` for permanent rules;
- ADRs for architecture decisions;
- `docs/handoff/PROGRESS.json` for current lot state.

`PROJECT-STATUS.json` is now only a compatibility pointer and must no longer be treated as a writable status source.

## Result

CLEANUP-07 intentionally does **not** change workflow commands, test coverage, release behavior, provider behavior, Compose behavior or runtime code.

Current policy:

- Node CI: active target architecture.
- Node Docker build workflow: active manual verification.
- Python validation/release workflow: frozen but retained until cutover.
- Lot-specific issue templates: removed when they no longer represent reusable work types.
- Generic bug/documentation/UI templates: retained.

## Deferred until production cutover

After Node production cutover and rollback certification:

1. remove the legacy Python workflow;
2. remove legacy Python release/integration scripts together with `server/`;
3. reconsider whether the manual Docker workflow adds value beyond Node CI;
4. consolidate remaining required checks into a single canonical Node CI/release model.
