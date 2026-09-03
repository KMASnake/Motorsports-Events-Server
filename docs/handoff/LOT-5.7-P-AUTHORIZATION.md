# Lot 5.7-P — Maintainer authorization

Date : 2026-08-21  
Decision : **AUTHORIZED**

## Reason

Lot 5.6 is globally maintainer validated and all blocking prerequisites are
closed. The inherited P3 concerning invalid anomaly queries is non-blocking.

## Normative scope

5.7-P is the minimal vertical normalization slice for the Production Preview.
It covers stable Event and Meeting identities, durable source links,
championship/circuit/session/status mappings, dates, overrides, deterministic
matching, idempotence, replay, provenance, publication gating and freshness.
It preserves Event-as-Session and keeps 5.6 source storage private.

Complex cross-provider reconciliation, complete mapping UX, advanced merging
of published objects, all-championship coverage, billing, self-service portal
and the complete Lot 5.7 remain outside this authorization.

## Normative documents

- Concept: `docs/handoff/PRODUCTION-PREVIEW-CONCEPT.md` ;
- Acceptance: `docs/handoff/PRODUCTION-PREVIEW-ACCEPTANCE.md` ;
- normative consolidation/corrections:
  `docs/handoff/PRODUCTION-PREVIEW-AUDIT-CORRECTIONS.md` ;
- effective Acceptance: PP-001 through PP-183.

## Structure and first gate

The normative corpus describes a single vertical slice and does not name any
technical sub-lots or a first implementation gate. Functional design and
Acceptance are complete; technical sequencing is incomplete.

- first gate ID: **5.7-P** ;
- first gate name: **technical implementation plan and gate decomposition** ;
- first gate type: **design** ;
- scope: translate the existing norms into an ordered, auditable technical
  plan without changing their scope ;
- prerequisites: validated Lot 5.6 and the three normative Production Preview
  documents above ;
- acceptance: every PP-001 through PP-183 criterion is allocated or explicitly
  declared cross-cutting, dependencies and stop rules are stated, and the
  first implementable gate is named without opening it ;
- stop rule: **STOP before implementation and request maintainer validation of
  the technical plan** ;
- first gate authorized: **YES** ;
- authorized technical sub-lot: **NONE**.

Lot 5.7 full: **UNAUTHORIZED**  
Lot 5.8+: **UNAUTHORIZED**  
Merge main: **UNAUTHORIZED**

Known inherited P3: invalid anomaly query returns `[]` instead of HTTP 400 —
**NON BLOCKING**.
