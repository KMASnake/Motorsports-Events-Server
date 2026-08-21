# Lot 5.6-G — API and ACP actions evidence

Date: 2026-08-21

Start SHA: `d219554ef8486e0283c0f6af30da552045a0128e`

Implementation final SHA: `a3d02b2f97c333a5660a42792809f52313fa205e`

Status: **MAINTAINER AUDIT PASS — VALIDATED ON 2026-08-21**

## Normative scope and implementation

The implementation derives from the operator views and four actions in `LOT-5.6-UI-CONTRACT.md` and AC-5.6-130 through AC-5.6-150 in `LOT-5.6-ACCEPTANCE.md`. It exposes only the internal administrator API. No ACP React component is changed because the interface itself is the unopened 5.6-H gate.

Implemented endpoints:

- `GET /api/v1/admin/provider-championships/:id/acquisition`: acquisition, current/finalization/history, quota eligibility, recent runs and allowed actions.
- `GET /api/v1/admin/provider-acquisition/anomalies`: bounded list with championship, provider, type and state filters.
- `GET /api/v1/admin/provider-source-entities/:id`: bounded source diagnostic, corrections, local observations, changes and anomalies; raw `source_data` is deliberately omitted.
- `PUT /api/v1/admin/provider-source-entities/:id/corrections/:fieldPath` and `POST /api/v1/admin/provider-source-corrections/:id/deactivate`: revision-aware correction lifecycle through `SourceProtectionService`, never hard delete.
- `PUT /api/v1/admin/provider-source-entities/:id/observations/:key`: idempotent local observation upsert through `SourceProtectionService`.
- `POST /api/v1/admin/provider-source-entities/:id/resync`: event request at the smallest available provider scope (its source season).
- `POST /api/v1/admin/provider-championships/:id/acquisition/resync-season`, `/resume-history`, and `/rebuild-history`: scheduler-backed, lease-aware and non-destructive actions. Costly season/rebuild actions require explicit `confirmed: true`.

All actions reuse administrator HMAC/session authorization. Actor identity comes from the authenticated principal; origin is server-controlled. Scheduler actions are transactionally recorded in `admin_audit_log`, preserve source data and corrections, reject leased historical streams with 409, and only enqueue eligible work. The recent-catchup resolver consumes the persisted requested season, including a previously `empty_confirmed` season.

## Files and migrations

- API/service: `acquisitionAdminService.ts`, `providerAcquisitionAdmin.ts`, `schedulerService.ts`, `acquisitionOrchestrator.ts`, `adminAudit.ts`, `server.ts`.
- Tests: `providerAcquisitionAdminRoutes.test.ts`, extended real PostgreSQL validation in `validate-lot56-corrections-observations.mjs`.
- Migration: none. Existing 0016 and 0023 durable structures are sufficient.
- ACP components: none in 5.6-G; the 5.6-H interface gate was opened only by the subsequent maintainer validation recorded below.

## Acceptance matrix

| IDs | Result | Evidence |
|---|---|---|
| G01–G03 | PASS | Bounded source detail separates corrections, observations, anomalies and acquisition state. |
| G04–G08 | PASS | Correction create/update/deactivate and observation create/update use validated 5.6-F services and revisions. |
| G09–G12 | PASS | UUID, field path, observation key and 65536-byte payload errors are controlled. |
| G13–G15 | PASS | Server-derived actor/origin plus 401 unauthenticated and 403 viewer tests. |
| G16–G23 | PASS | Real PostgreSQL proves no source mutation, replay survival, concurrency serialization, no hard delete, provenance and rollback. |
| G24 | PASS | Four actions use existing streams, leases, priority boost, quota/cadence path and atomic audit; no direct provider call. |
| G25 | PASS | Correction/observation upserts and queued season de-duplication are idempotent. |
| G26 | PASS | No public Preview API, business normalization, reconciliation, publication, entitlement or other 5.7 surface. |

Totals: **26 PASS, 0 PARTIAL, 0 FAIL, 0 NOT TESTED**.

## Executed validation

- Focused API/protection/scheduler tests: PASS — 10/10.
- Complete API suite: PASS — 209/209.
- API typecheck, lint and build: PASS.
- `test-lot56-corrections-observations.sh`: PASS — disposable PostgreSQL, real HTTP injection, persistence, replay, concurrent provider updates, rollback, provenance, actions and restart.
- `test-lot56-transaction.sh`: PASS.
- `test-lot56-orchestration.sh`: PASS.
- `test-lot56-temporality.sh`: PASS.
- `test-lot54-scheduler.sh`: PASS — 8/8 focused tests and migration rollback/reapply.
- `test-lot55-quota-cadence.sh`: PASS — 61 cases, zero real provider requests, zero provider credits.
- Repository validation and release build: PASS; extracted ZIP validation PASS and SHA-256 verification PASS.
- ACP UI tests: NOT APPLICABLE — no UI component is authorized or changed in 5.6-G.

## Security, risks and boundary

Administrative authorization, human-session CSRF protection and technical HMAC behavior are reused unchanged. Inputs are schema-validated; protection payloads retain the shared 65536-byte service bound. Responses contain no provider credentials or raw provider payload. The operational API caps anomaly results at 500 and source changes at 200.

Residual risk: visual ACP rendering and interaction tests remain intentionally deferred to the separately governed 5.6-H interface gate. A non-blocking P3 audit observation notes that invalid filters on `GET /api/v1/admin/provider-acquisition/anomalies` currently return `[]` instead of an explicit HTTP 400; it does not reopen or block 5.6-G. Lot 5.6 remains globally unvalidated. Lot 5.7+, Production Preview client surfaces and merge to `main` remain unauthorized.

**Technical recommendation: PASS FOR MAINTAINER AUDIT.** The maintainer subsequently audited this evidence PASS and validated 5.6-G on 2026-08-21 with 26 PASS, 0 PARTIAL, 0 FAIL and 0 NOT TESTED. This decision opens only the 5.6-H implementation gate — interface ACP.
