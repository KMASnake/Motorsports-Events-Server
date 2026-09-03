# CLEANUP-12 — Final non-regression and complexity audit

Date: 2026-08-26  
Branch: `cleanup/architecture-state-model`  
Functional baseline: `8a603232bfec44711cfac382e4f73687dd370e53`  
Audited head before this report: `f2d19e350f464a4f2d29f6320be2dfeb0f14e4df`

## Verdict

**PASS — the cleanup reduced active repository/documentation complexity without changing the application runtime contract.**

The baseline-to-head Git comparison is a strict fast-forward on the cleanup branch: 69 commits ahead, 0 behind. The cleanup delta is concentrated in documentation, obsolete wrappers/markers, historical handoff relocation, repository metadata and narrowly scoped CI path maintenance. No API/provider/database/normalization/publication/frontend source implementation was changed by the cleanup sequence. The only `apps/` deletion in the delta is the generated `apps/web/tsconfig.tsbuildinfo` artifact.

This is a repository/static non-regression audit. It does **not** manufacture runtime evidence: no real provider call, Production Preview activation, external onboarding, merge to `main`, database migration or VPS operation is authorized by CLEANUP-12. Gate 5.7-P-F remains governed by `docs/handoff/PROGRESS.json`.

## 1. Scope checked

Comparison used:

```text
8a603232bfec44711cfac382e4f73687dd370e53
  ..
f2d19e350f464a4f2d29f6320be2dfeb0f14e4df
```

The comparison reports 69 cleanup commits and no divergence from the functional baseline.

Surfaces reviewed from the delta:

- application source under `apps/api` and `apps/web`;
- database/provider/normalization/publication boundaries;
- root operational files and legacy Python rollback contract;
- scripts and package entrypoints;
- GitHub Actions and templates;
- active Handbook, roadmap, decisions and handoff state;
- historical handoff/handover material moved under `docs/archive/`;
- root status/manifest/marker duplication;
- generated build artifacts committed to Git.

## 2. Non-regression result

### Runtime implementation

**PASS.** No TypeScript/React application implementation file is modified by the cleanup delta. `apps/web/tsconfig.tsbuildinfo` is removed because it is generated build state, not source.

Therefore CLEANUP-05 through CLEANUP-11 do not alter:

- HTTP/API behavior;
- provider acquisition/discovery/scheduler behavior;
- quota/cadence rules;
- normalization or publication behavior;
- database schema or migration head;
- Preview/public visibility rules;
- frontend behavior;
- worker behavior.

### Legacy Production rollback path

**PASS by preservation.** `VERSION`, `BASELINE.json`, `.coveragerc`, `pytest.ini`, `Caddyfile`, `install.sh` and the root operational wrappers remain intentionally present. `server/LEGACY.md` makes their frozen role explicit. Removal is deferred until Node Production cutover and rollback retirement.

### Scripts

**PASS.** Obsolete thin Windows wrappers and bootstrap/test recipes were removed only after dependency classification. Maintained entrypoints remain in `package.json` and their referenced shell/Node scripts. Historical recipes are no longer presented as canonical execution paths.

### CI

**PASS with narrow cleanup-only edits.** CI workflow changes in the cleanup delta are limited to removing stale path references or updating canonical documentation/script paths. No application test policy is intentionally weakened by CLEANUP-12.

### Documentation state

**PASS.** The active documentation hierarchy is now explicit:

```text
README.md
├── PROJECT-HANDBOOK.md
├── docs/handoff/PROGRESS.json       # canonical current status
├── docs/handoff/README.md           # active gate/contract index
├── docs/handbook/roadmap/ROADMAP.md
├── docs/handbook/DECISIONS.md
├── docs/handbook/architecture/      # ADR
└── docs/archive/README.md            # historical material
```

Historical handoffs remain available but are no longer mixed with current gate evidence.

## 3. Complexity before / after

The cleanup intentionally measures **active cognitive/operational complexity**, not raw repository byte size: historical evidence is archived rather than destroyed, so total bytes are not a useful success metric.

| Surface | Before baseline | After cleanup | Result |
|---|---|---|---|
| Current status sources | Several large root status/next-step files plus `PROGRESS.json` | `PROGRESS.json` canonical; root status files reduced to compatibility pointers | Strong reduction |
| Root status prose | `PROJECT_STATUS.md` ~1,224 lines larger in baseline delta | compact compatibility pointer | Strong reduction |
| Root next-step prose | `NEXT_STEPS.md` ~607 lines removed/replaced by canonical pointers | compact pointer | Strong reduction |
| Root handoff manifest | `HANDOVER-MANIFEST.json` contained ~3,904 lines | removed | Strong reduction |
| Package/handbook manifests | multiple generated/duplicate JSON manifests | removed | Reduction |
| Root marker files | `BUILD`, `GIT_COMMIT`, `MILESTONE`, `PROJECT`, validation marker JSONs | removed when unconsumed | Reduction |
| Thin root command layer | `Makefile` aliases duplicated maintained commands | removed | Reduction |
| Historical handoff visibility | historical and active files mixed in `docs/handoff` / `docs/handover` | history under `docs/archive/handoff-history`, current contracts remain active | Strong reduction |
| Historical handbook prompt | active-looking `docs/handbook/CODEX-PROMPT.md` | archived | Reduction |
| Windows lot wrappers | obsolete `.cmd`/`.ps1` wrappers for old lots | removed after dependency audit | Reduction |
| GitHub issue templates | obsolete Lot 4 templates | removed | Reduction |
| Generated TS build state | tracked `apps/web/tsconfig.tsbuildinfo` | removed/ignored | Reduction |
| Architecture truth | provider lifecycle spread across implementation/history | `docs/provider-state-model.md` + architecture links | Better cohesion |
| Navigation | current truth required repository knowledge | principal truth reachable from root README in 1–2 clicks | Strong reduction |

The baseline-to-head comparison also shows large net removals from duplicate active prose and manifests while historical evidence is predominantly represented as Git renames into archive paths. This is the intended result: **less active surface without loss of audit history**.

## 4. What remains for the MVP

Keep these surfaces until the MVP/Production Node transition is complete:

1. **Node target runtime** — `apps/api`, `apps/web`, migrations, provider/acquisition/normalization/publication code and their tests.
2. **Canonical project governance** — `PROJECT-HANDBOOK.md`, `docs/handoff/PROGRESS.json`, active handoff contracts, roadmap, decisions and ADRs.
3. **Maintained validation/release entrypoints** — `package.json`, referenced scripts, GitHub Actions and current Docker/Preproduction configuration.
4. **Frozen Python rollback capability** — `server/`, legacy operational wrappers, `VERSION`, `BASELINE.json`, Python test configuration and historical Production Caddy contract, until Node cutover is validated and rollback retirement is explicitly authorized.
5. **Archive evidence** — `docs/archive/` remains read-only historical evidence; it is not part of the normal implementation path.
6. **5.7-P-F safety boundaries** — bounded provider execution, worker isolation, staging persistence and external evidence requirements remain in force exactly as tracked by `PROGRESS.json`.

## 5. Explicitly defer until after MVP / cutover

Do **not** spend additional MVP cleanup effort on these items unless they become blocking:

- deleting the frozen Python backend or its rollback/upgrade scripts;
- removing `VERSION`, `BASELINE.json`, `.coveragerc`, `pytest.ini`, `Caddyfile` or `install.sh` while legacy rollback is still required;
- rewriting historical documents merely to modernize wording;
- flattening or deleting `docs/archive/`;
- consolidating validated gate evidence only for cosmetic reasons;
- introducing a new documentation generator/manifest system to replace the manifests just removed;
- broad refactors of provider, scheduler, normalization or publication code under the label of cleanup;
- Production Preview activation, real provider execution, external client onboarding, full Lot 5.7, Lot 5.8+ or merge to `main` without their separate authorization gates.

## 6. Residual risks

### R1 — Legacy dual runtime

The largest remaining structural complexity is intentional: Node target plus frozen Python Production rollback. Removing it now would increase operational risk. Resolve only at Production Node cutover.

### R2 — Historical links

Archived handoff paths can make old internal links stale. This is acceptable for historical evidence as long as active documentation does not depend on those old paths. New work must link to active contracts or archive paths explicitly.

### R3 — Gate F is not complete

Repository cleanup does not change the canonical 5.7-P-F status. Mandatory external evidence is still outstanding. Do not interpret this audit PASS as gate-F validation.

### R4 — Runtime test evidence

This final audit establishes that cleanup did not modify runtime implementation. It does not replace the existing CI/VPS/provider certifications for the functional baseline. If the branch is prepared for merge later, run the maintained generic validation suite and the then-current gate-specific certification before merge.

## 7. Final cleanup acceptance

```text
CLEANUP_12=PASS
CLEANUP_SERIES=COMPLETE

FUNCTIONAL_BASELINE=8a603232bfec44711cfac382e4f73687dd370e53
AUDITED_HEAD=f2d19e350f464a4f2d29f6320be2dfeb0f14e4df
COMMITS_AUDITED=69
BRANCH_RELATION_TO_BASELINE=AHEAD_ONLY
RUNTIME_SOURCE_CHANGED_BY_CLEANUP=NO
DATABASE_SCHEMA_CHANGED_BY_CLEANUP=NO
PROVIDER_RUNTIME_CHANGED_BY_CLEANUP=NO
NORMALIZATION_PUBLICATION_CHANGED_BY_CLEANUP=NO
FRONTEND_RUNTIME_CHANGED_BY_CLEANUP=NO
LEGACY_ROLLBACK_PRESERVED=YES
HISTORICAL_EVIDENCE_PRESERVED=YES
ACTIVE_DOCUMENTATION_SURFACE_REDUCED=YES
ROOT_NOISE_REDUCED=YES
NAVIGATION_SIMPLIFIED=YES

MVP_KEEP_NODE_TARGET=YES
MVP_KEEP_CANONICAL_GOVERNANCE=YES
MVP_KEEP_VALIDATION_RELEASE_ENTRYPOINTS=YES
MVP_KEEP_LEGACY_ROLLBACK_UNTIL_CUTOVER=YES
POST_MVP_DEFER_ARCHIVE_COSMETICS=YES
POST_MVP_DEFER_LEGACY_DELETION_UNTIL_CUTOVER=YES

REAL_PROVIDER_CALL_AUTHORIZED_BY_CLEANUP_12=NO
PRODUCTION_PREVIEW_AUTHORIZED_BY_CLEANUP_12=NO
MERGE_MAIN_AUTHORIZED_BY_CLEANUP_12=NO
```

CLEANUP-12 closes the repository cleanup campaign. Further changes should return to the canonical product/gate workflow rather than extending cleanup for cosmetic reasons.