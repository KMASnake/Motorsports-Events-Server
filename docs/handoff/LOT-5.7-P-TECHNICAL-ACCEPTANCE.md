# Lot 5.7-P — Technical Acceptance

Date : 2026-08-21  
Status : **COMPLETE — AWAITING MAINTAINER AUDIT**

The functional Acceptance remains PP-001 through PP-183. This matrix adds
testable technical criteria and maps them to the gates in
`LOT-5.7-P-GATES.md`. PASS requires objective evidence; `NOT TESTED` cannot be
treated as PASS.

| ID | Gate | Testable criterion |
|---|---|---|
| PP-T01 | A | Additive migrations create the approved minimal schema on fresh and current databases without changing 5.6 tables. |
| PP-T02 | A | Every migration rolls down/up on disposable PostgreSQL without losing pre-existing 5.6 data. |
| PP-T03 | A | Event and Meeting source-link uniqueness prevents duplicate normalized identity under concurrent inserts. |
| PP-T04 | A | One Event belongs to zero or one Meeting and Meeting sessions remain projections, not copied business entities. |
| PP-T05 | A | UUID tombstones cannot be reused and all temporal columns accept pre-1970 values. |
| PP-T06 | A | Repository/domain dependency tests preserve architecture boundaries and expose no public route. |
| PP-T07 | B | Replaying the same source revision/version produces identical Event, Meeting and links with no duplicate. |
| PP-T08 | B | A modified linked source deterministically updates the same UUID; restart and transaction retry remain idempotent. |
| PP-T09 | B | Existing link, hard incompatibility, score and review ordering matches PP-037–051 plus audit-corrected thresholds. |
| PP-T10 | B | Ambiguous matching never auto-merges; no LLM can decide production identity. |
| PP-T11 | B | Championship, circuit, session, status and temporal mappings are explicit, versioned and provenance-bearing. |
| PP-T12 | B | Unknown session maps to `other` with its human name; unknown required identity enters review without guessing. |
| PP-T13 | B | Active corrections affect effective values and survive replay; disabled corrections stop applying without deletion. |
| PP-T14 | B | Absence is accepted only after complete traversal and never deletes/unpublishes; cancelled/postponed remain explicit. |
| PP-T15 | B | Reliable and estimated ends, DST, UTC, pre-1970 and PP-181–183 behave exactly as specified. |
| PP-T16 | B | Fencing rejects a stale worker and checkpoint advances only with the durable normalization result. |
| PP-T17 | C | Candidate promotion, effective public state, monotone revision and change-log row commit atomically. |
| PP-T18 | C | No public change is emitted for internal-only or rejected candidate changes. |
| PP-T19 | C | Last-known-good survives an ambiguous/bad candidate and first publication is blocked in review. |
| PP-T20 | C | Blocking is granular Event→Meeting→Championship and kill switch preserves source/mappings/history. |
| PP-T21 | C | Removed emits a permanent tombstone; cancellation emits updated, never removed. |
| PP-T22 | C | From-scratch and incremental rebuilds converge without UUID or sequence reset. |
| PP-T23 | D | OpenAPI and implementation expose only the normative read-only V1 routes and stable optional extensions. |
| PP-T24 | D | Contract tests prove no source IDs/payloads, corrections, scores, credentials or internal anomalies are exposed. |
| PP-T25 | D | Event filters, mutual exclusion, stable list ordering, opaque cursors and hard page limits are enforced. |
| PP-T26 | D | Snapshot and sync cursors are distinct; 90-day configurable expiry yields HTTP 410 and full-resync signal. |
| PP-T27 | D | `/changes` supports monotone at-least-once replay, operations, revisions and optional `include=data`. |
| PP-T28 | D | Error envelopes contain safe code/message/request_id and never stack, SQL or secret details. |
| PP-T29 | E | API keys are independent from admin auth, shown once, HMAC-stored, constant-time verified, rotatable and immediately revocable. |
| PP-T30 | E | Scopes and F1 entitlements are separate and re-evaluated for every request/cursor. |
| PP-T31 | E | Unauthorized filter/scope returns 403 while inaccessible individual UUID returns 404. |
| PP-T32 | E | Per-client 60/minute and 10,000/day defaults, UTC reset, headers and distinct 429 errors are proven. |
| PP-T33 | E | 304 counts and 5xx does not consume daily quota; concurrent counters cannot exceed limits silently. |
| PP-T34 | E | Logs and audits contain safe identifiers but no Authorization, full key, digest, pepper or payload. |
| PP-T35 | E | Minimal ACP creates/suspends clients, manages keys, F1 entitlement and limits without self-service/billing features. |
| PP-T36 | F | A real F1 5.6→5.7-P→API→changes scenario preserves UUIDs across replay, source update and override. |
| PP-T37 | F | All PP-162–183 certification criteria pass or have maintainer-approved N/A evidence. |
| PP-T38 | F | Docker staging smoke, liveness/readiness, TLS/CORS/security, backup/restore and release rollback pass. |
| PP-T39 | F | Existing 5.4, 5.5 and complete 5.6 recipes pass with zero real provider credit use unless explicitly approved. |
| PP-T40 | F | Full matrix has zero P1/P2/blocking P3, no skipped mandatory test and exact release SHA evidence. |
| PP-T41 | ALL | Full 5.7 generalization, 5.8 observability, billing/self-service, full mapping UX and cache remain absent. |
| PP-T42 | ALL | No gate begins until the prior gate is maintainer-validated and the next gate explicitly authorized. |

## Gate acceptance summary

- A: PP-T01–06 — schema, identity constraints and repositories only.
- B: PP-T07–16 — deterministic normalized candidate pipeline.
- C: PP-T17–22 — atomic public state and rebuild.
- D: PP-T23–28 — definitive read-only V1 and incremental sync.
- E: PP-T29–35 — client security, rights, limits and minimal ACP.
- F: PP-T36–40 — operational and F1 certification.
- All: PP-T41–42 and relevant functional PP criteria.

## Security and regression

Every gate must include negative tests for its threat surface. Gates D/E require
enumeration, injection, cursor abuse, resource exhaustion and secret-redaction
tests. All gates must keep 5.6 source private and preserve its acquisition,
correction, absence, finalization, fencing and temporal invariants.

## Definition of Done

5.7-P is a candidate for maintainer validation only when PP-001–183 and
PP-T01–42 are PASS or explicitly N/A with maintainer-approved justification;
all six gate audits are closed; F1 E2E, security, migrations, rebuild,
backup/restore and rollback evidence are reproducible; P1/P2/blocking P3 are
zero; full 5.7/5.8+ remain unopened. This document authorizes no implementation.
