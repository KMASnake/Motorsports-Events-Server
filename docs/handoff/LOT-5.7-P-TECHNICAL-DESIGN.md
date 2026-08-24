# Lot 5.7-P — Technical design

Date : 2026-08-21  
Status : **DESIGN VALIDATED — GATE E MAINTAINER VALIDATED; F UNAUTHORIZED**

## 1. Context and objective

5.7-P is the smallest permanent vertical slice that consumes the private,
replayable 5.6 source graph and produces stable normalized F1 Preview data. It
uses the definitive V1 objects and routes; it creates no temporary Preview API
or disposable model. This document translates the validated Production Preview
Concept and effective Acceptance PP-001 through PP-183 into an implementable
technical architecture without authorizing any gate.

## 2. Functional matrix

Priority `M` means mandatory for the initial Preview; `D` means explicitly
deferred. “5.6 input” is read-only from the normalization boundary.

| ID | Requirement | Norm | Priority | 5.6 dependency / input | Output | Actor | Degraded behavior / out of scope |
|---|---|---|---|---|---|---|---|
| PP-F01 | Keep all 5.6 internals private | Concept §2; PP-001–004 | M | source graph | normalized boundary only | worker | reject any source payload exposure |
| PP-F02 | Stable Motorsports Events UUIDs and tombstones | Concept §4; PP-005–009 | M | source identity | durable public identity | worker | never recycle removed UUIDs |
| PP-F03 | Separate acquisition and client visibility | Concept §5; PP-010–014 | M | acquisition state | internal/preview/public/suspended | admin | suspension preserves source and mappings |
| PP-F04 | Event-as-Session public model | Concept §3/6; PP-015–023 | M | source event/session | normalized Event | worker/client | unknown type maps to `other`, human name retained |
| PP-F05 | Stable Meeting read projection | Concept §3/7; PP-024–029 | M | related source entities | Meeting + projected sessions | worker/client | partial allowed; complete only when proved |
| PP-F06 | Durable source links and normalization version | Concept §8; PP-030–036 | M | source entity ID/revision | Event/Meeting links | worker | linked source never silently remapped |
| PP-F07 | Deterministic Event matching | Concept §9; PP-037–046 + corrections | M | normalized candidate signals | linked/review/new | worker/admin | ambiguity means review, never automatic merge |
| PP-F08 | Deterministic Meeting matching | Concept §9; PP-047–051 | M | championship/season/round/events | Meeting link | worker/admin | ambiguous candidate remains review |
| PP-F09 | Durable manual identity decisions | Concept §10; PP-052–054 | M | candidate decision | linked/rejected audit | admin | rejected candidate is not repeatedly proposed |
| PP-F10 | Preserve active overrides | Concept §11; PP-055–057 | M | source + active 5.6 correction | effective normalized value | worker/admin | convergence does not delete override |
| PP-F11 | Non-destructive absence and explicit status | Concept §12; PP-058–061 | M | complete traversal observation | freshness/status | worker | absence never deletes or unpublishes automatically |
| PP-F12 | Last-known-good and granular publication | Concept §13; PP-062–073 | M | candidate + prior public state | promoted/review/blocked | worker/admin | smallest unreliable scope blocked |
| PP-F13 | Public freshness/completeness only | Concept §14 | M | cadence and traversal evidence | simple quality object | client | internal anomaly mechanics hidden |
| PP-F14 | Read-only definitive `/api/v1` resources | Concept §15–16; PP-074–085 | M | public state | championships/events/meetings | client | stable cursor errors; no breaking V1 change |
| PP-F15 | Atomic incremental client sync | Concept §17; PP-086–104 | M | promoted public change | revisions + monotone change log | client | expired cursor gives 410/full resync |
| PP-F16 | Client API-key lifecycle | Concept §18; PP-105–115 | M | client/key administration | authenticated client | admin/client | secret shown once, never logged or recoverable |
| PP-F17 | Scopes and F1 entitlement | Concept §19; PP-116–122 | M | client rights | filtered dataset | client | 403 filter/scope; 404 inaccessible UUID |
| PP-F18 | Per-client rate limit and daily quota | Concept §20; PP-123–132 | M | authenticated request | decision + headers | client | 429; 5xx not charged to daily quota |
| PP-F19 | Minimal request/audit observability | Concept §21/26; PP-133–135 | M | request/transition | safe logs/metrics | operator | no Authorization, key or source payload |
| PP-F20 | Minimal ACP client operations | Concept §22; PP-180 | M | admin action | client/key/F1 rights/limits | admin | no self-service or commercial portal |
| PP-F21 | Production-safe runtime and deployment | Concept §23–29; PP-136–161 | M | release and DB | live/ready service | operator | provider outage may retain ready last-known-good |
| PP-F22 | F1 certification and E2E proof | Concept §30–32; PP-162–180 | M | real F1 acquisition | certified Preview | maintainer | historical secondary issue may be non-blocking |
| PP-F23 | 5.6 finalization hierarchy and J+30 | audit corrections PP-181–183 | M | 5.6 finalization evidence | normalized final state/anomaly lifecycle | worker | never forge public `completed` |
| PP-F24 | Advanced cross-provider/general 5.7 | Concept §8.1/§24 | D | — | — | — | deferred to full 5.7 |
| PP-F25 | Billing, self-service, full portal and Kubernetes | Concept §22/§23; PP §24 | D | — | — | — | deferred to later lots |

## 3. Scope classification

| Capability | Classification | Rationale |
|---|---|---|
| Minimal normalized Event, Meeting projection, mapping, identity, deduplication, idempotence, provenance | IN_SCOPE | Core 5.7-P path |
| Session | IN_SCOPE AS EVENT | Event-as-Session; `sessions[]` is only a Meeting projection |
| Active local corrections, status, temporality, championship, circuit, type | IN_SCOPE | Required normalized effective state |
| Provider absence | IN_SCOPE, NON-DESTRUCTIVE | Drives freshness/review only after complete traversal |
| Preview API, API keys, scopes, F1 entitlement, rate limit/quota, filtering, pagination, versioning | IN_SCOPE | Explicit Concept §§15–20 |
| Publication, refresh, tombstones and logical removal | IN_SCOPE | Required client state and incremental sync |
| Minimal logs, metrics and audit | IN_SCOPE | Preview operations only |
| Cache | OUT_OF_SCOPE | No cache is required by the normative corpus |
| Complex cross-provider reconciliation, advanced presence, full mapping UX | DEFERRED_TO_5_7 | Explicitly deferred after Preview |
| Full runs/logs/alerts | DEFERRED_TO_5_8 | Only minimum Preview observability is included |
| Pixel-perfect full provider UI | DEFERRED_TO_LATER | Roadmap 5.9 |
| Billing, Stripe, self-service developer portal, commercial plans | DEFERRED_TO_LATER | Explicitly outside initial Preview |

## 4. 5.7-P versus full 5.7

5.7-P normalizes the F1 pilot through explicit, versioned mappings, stable
source links and conservative matching; it supports only the operations needed
to publish reliable Preview data. It does not generalize every provider or
championship, merge ambiguous already-published objects, deliver exhaustive
presence tooling, or implement complex cross-provider reconciliation. Full 5.7
may add those capabilities without replacing 5.7-P identities, links, objects
or contracts.

## 5. Boundary with 5.6

The worker reads `provider_source_entities`, their typed graph, provider and
championship identities, source timestamps/status, acquisition/finalization
state, active corrections and local observations through repository interfaces.
It never writes acquisition checkpoints, traversals, source payloads, 5.6
corrections or observations. A normalization input envelope contains source
entity ID/kind/revision, provider identity, championship source identity,
structured fields, completeness evidence, active effective corrections and
5.6 provenance. Local observations are diagnostic evidence only; they do not
override values unless promoted through the existing correction workflow.

## 6. Architecture

```text
5.6 source repositories (private)
  -> normalization input envelope
  -> deterministic mapper and identity resolver
  -> candidate normalized state
  -> quality/publication gate
  -> normalized repositories + public change log (one transaction)
  -> authenticated read-only /api/v1
```

The application layer orchestrates units; domain code owns mapping, identity,
quality and transition rules; infrastructure owns PostgreSQL repositories,
locks and crypto; API owns client representations. Provider adapters never call
the public model directly.

## 7. Minimal data model

All migrations are additive and reversible while no promoted data would be
lost. UUIDs are application-generated; timestamps are `timestamptz` and accept
pre-1970 values.

| Entity/table | Role and key fields | Constraints and indexes |
|---|---|---|
| `meetings` | `id` UUID PK, championship, season, name, round, venue, UTC range, timezone, quality, revision, lifecycle, created/updated | index championship/season/start; lifecycle includes active/removed; UUID never reused |
| `meeting_events` | `meeting_id`, `event_id`, order | PK pair; unique `event_id` (zero or one Meeting); FK restrict/cascade only for unpromoted rollback |
| `event_source_links` | source entity → existing Event UUID, provider, normalization version, decision, timestamps | unique source entity; index event; no silent remap |
| `meeting_source_links` | source entity/group → Meeting UUID | unique typed source key; index meeting |
| `normalization_decisions` | source, candidate type/id, linked/rejected/review/create, rule version, score/signals, actor, reason, created | immutable audit; unique active decision identity |
| `normalized_candidates` | source revision/version, candidate structured state, state pending/review/promoted/rejected, error code, timestamps | unique source revision + normalization version; no raw payload duplication |
| `public_resource_states` | resource type/id, revision, canonical representation checksum, publication state, promoted_at, removed_at | PK type/id; monotone revision; tombstone retained |
| `public_change_log` | `sequence` bigint PK, resource type/id, operation, changed fields, occurred_at | monotone sequence; indexes sequence and resource; same commit as public state |
| `normalization_checkpoints` | work scope, source revision/version, lease/run fencing, completed_at | unique scope; advance only with durable result |
| `api_clients` | id, name, active/suspended/closed, timestamps, rate/quota settings | name/index; no admin-session reuse |
| `api_keys` | id, client, environment, name, prefix, HMAC digest, status, expiry/use/revoke timestamps | unique prefix; digest only; index active lookup |
| `api_client_scopes` | client + one of four read scopes | PK pair; constrained enum |
| `api_client_championships` | client + championship entitlement | PK pair; F1 first |
| `api_client_daily_usage` | client, UTC day, successful charge count | PK client/day; atomic increment; 5xx excluded |

Existing Championships, Events, circuits and active correction storage remain
authoritative where already present; migrations extend rather than duplicate
them. Exact legacy-column reuse must be proven in gate A before DDL is accepted.

## 8. Identity and idempotence

Resolution order is: existing durable link, deterministic identity, plausible
candidates minus hard incompatibilities, controlled score, then
auto-match/review/create. A replay of the same source revision/version returns
the same result. An updated source deterministically updates the linked object.
Unique link and candidate keys plus one transaction prevent duplicates after
restart or retry. A source-key change is a new source until an explicit durable
identity decision links it; it never silently steals an identity. Published
links cannot be remapped by a normalization-version change. Automatic complex
cross-provider merge is forbidden in 5.7-P.

## 9. Mappings and effective values

Mappings are explicit per provider/championship and versioned. Championship and
circuit use configured stable IDs; session/status use tested enum tables;
unknown session types become `other` with the human label retained; unknown
required championship/circuit identity becomes `review_required`, never a
guess. Nullable source fields remain null unless a documented deterministic
fallback exists. Each effective field records source entity/revision, mapping
version and whether an active correction supplied it. Mapping failures use
bounded codes and safe metadata, never raw payloads.

An active 5.6 correction participates in the effective input and survives
replay/provider changes. A disabled correction ceases to affect the next
candidate but remains audited. Source raw/structured evidence stays in 5.6.

## 10. Presence and temporal rules

`seen` comes from a successful observation. `not_observed` is accepted only
after a complete traversal and changes freshness/diagnostics, not identity or
publication. `stale` is derived relative to expected 5.5 cadence. `removed` is
a deliberate public lifecycle transition producing a permanent tombstone;
`retired` is not inferred from absence. Cancelled/postponed/completed require
reliable explicit evidence.

Public starts/ends are UTC ISO-8601 with IANA timezone. A reliable source end is
public; an estimated 5.6 end remains internal and public `ends_at` is null.
Finalization follows the single 5.6-D hierarchy and PP-181–183. DST conversion
uses the named zone at the event instant. No positive-epoch assumption or epoch
zero sentinel is allowed.

## 11. Public API

Gate D adds no `/preview` namespace. It implements read-only GET collections
and details for championships, events and meetings plus `/api/v1/changes`.
Collections use opaque stable cursors (50/default, 100/max); changes uses a
separate cursor (100/default, 500/max), 90-day configurable retention and 410
for expiry. Events support the normative filters and reject mutually exclusive
championship filters. Responses expose normalized public fields only—never
provider IDs, raw payload, internal corrections, scores or anomalies. OpenAPI
is contractual. No cache is required; conditional caching may be proposed only
in a later audited gate without weakening entitlement checks.

## 12. Client authentication, authorization and quota

Gate E uses Bearer API keys independent from admin authentication. The complete
key is generated with strong randomness, displayed once, and stored as an
HMAC-SHA-256 digest using an off-database pepper; verification is constant-time.
Multiple active keys support rotation; revoke/suspend is immediate. Four read
scopes are separate from F1 entitlement. Rights are checked on every request,
including cursor continuation. Explicit unauthorized dataset/scope gives 403;
individual inaccessible UUID gives 404.

The per-client initial limits are 60/minute and 10,000/day, configurable. Daily
reset is UTC, counters are atomic, 304 counts, and 5xx is not charged to daily
quota. Anti-abuse also covers unauthenticated requests. Only minimal ACP
create/suspend/reactivate client, generate/revoke key, F1 entitlement and limits
is in scope.

## 13. Transactions, rebuild and concurrency

One normalization unit locks/fences the source work scope, reads one consistent
5.6 revision, resolves identity, persists candidate/link/effective state,
promotes public state when eligible, appends the public change and advances the
normalization checkpoint in one PostgreSQL transaction. A stale lease cannot
commit. Retry after pre-commit crash is a no-op or deterministic replay; after
commit it observes the checkpoint. No public change is emitted when effective
public state is unchanged.

From-scratch rebuild replays ordered 5.6 entities into empty derived tables.
Incremental rebuild starts after the durable checkpoint. A new mapping version
creates new candidates but cannot silently remap published identities. Purge is
limited to unpromoted derived candidates; public UUIDs/change sequences are
never reset. Application rollback retains forward-compatible expanded schema
and monotone cursors.

## 14. Security threat model

| Threat | Required control |
|---|---|
| auth bypass/key enumeration | HMAC verification, constant-time compare, generic 401, bounded prefix lookup |
| resource/UUID enumeration | entitlement filter before lookup; inaccessible detail returns 404 |
| SQL/filter injection and mass assignment | typed query schemas, parameterized repositories, explicit response/write allowlists |
| source/correction leakage | representation boundary and contract tests forbidding all internal fields |
| secret logging | structured redaction; never log Authorization, digest, pepper or full key |
| stale cache/rights | no shared response cache initially; re-evaluate rights per request/cursor |
| replay/duplicate normalization | unique links, version keys, transaction and fencing |
| pagination abuse/N+1/exhaustion | signed/validated opaque cursor, hard page limits, indexed bulk queries, timeouts |
| rate abuse | per-client limiter/quota plus unauthenticated edge protection |
| cross-client cursor use | bind sync cursor to dataset/client or re-evaluate equivalent rights on every page |

## 15. Observability and tests

Metrics are limited to normalization outcomes/duration/lag, review and mapping
failures, promotion failures, API latency/status/429, worker health and F1
quality. Logs include request/run/source internal IDs and bounded error codes,
not payloads or secrets. Identity/manual/publication transitions are audited.
This does not implement the full 5.8 alerting product.

Each gate requires unit, repository and PostgreSQL integration tests; gates D/E
add OpenAPI, auth, entitlement, cursor, quota and abuse tests; gate F adds real
Docker, backup/restore, rollback and F1 end-to-end proofs. Existing 5.4–5.6
recipes remain green.

## 16. Migrations and deployment

Gate A owns additive normalized persistence; gate C owns publication/change-log
storage; gate E owns client security/quota storage. Each migration has a tested
up/down cycle on a disposable database and supports expand/migrate/contract.
No startup DDL is allowed. Backups precede production migration, application
rollback does not rewind public sequences, and API/worker deploy independently.

## 17. Gate decomposition and risks

The normative sequence is defined in `LOT-5.7-P-GATES.md`: A persistence,
B normalization, C publication, D API, E client security, F certification.
Principal risks are premature public exposure, identity remap, ambiguous
matching, non-atomic change logs, entitlement leakage, cursor instability and
scope creep into full 5.7/5.8. Stop rules and PP-T criteria isolate each risk.

## 18. Boundary and governance

Gates D and E are maintainer-validated. Preview activation in Production and
external client onboarding remain unauthorized. Gate F, full 5.7, 5.8+, merge
to `main`, general cross-provider reconciliation, advanced mapping UX and the
commercial platform remain unauthorized.
