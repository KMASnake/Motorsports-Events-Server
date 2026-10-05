# R1-A2.1 — Provider failure classification contract

This slice supplies acquisition error metadata. It does not implement durable
retry policy, retry selection, exhaustion or a migration. Authorizations and
current project state remain exclusively in `PROGRESS.json`.

## HTTP boundary

`ProviderHttpError.classification` is the typed failure envelope. A successful
JSON result is returned directly, without an error category. Non-2xx status is
classified before body reading, content-type validation or JSON parsing. The
error body is discarded; cancellation errors cannot replace HTTP semantics.
Successful responses retain bounded streaming and JSON checks. Invalid UTF-8
is a payload/encoding error rather than silently replaced text.

| Status or failure | Category |
| --- | --- |
| 429 | HTTP_RATE_LIMIT |
| 408, 425, 500–599 | HTTP_TRANSIENT |
| 401 | HTTP_AUTHENTICATION |
| 403 | HTTP_AUTHORIZATION |
| Other 4xx except 409 | HTTP_CLIENT_PERMANENT |
| 409, other non-2xx | HTTP_OTHER |
| Invalid successful content type / JSON | INVALID_CONTENT_TYPE / INVALID_JSON |
| Oversized body, invalid encoding or adapter payload | PAYLOAD_OR_SCHEMA_ERROR |
| Missing credential, invalid acquisition source config | CONFIGURATION_ERROR |

The envelope retains `code`, `httpStatus`, `providerResponseReceived`, relevant
headers, `transportCode`, callback stage and Retry-After metadata. Header names
are limited to content type/length, date, Retry-After and standard/common quota
headers. Each retained value is at most 512 characters and contains no control
characters. Arbitrary response headers, bodies, URLs, runtime messages and error
causes are not retained in this envelope.

## Retry-After primitive

An injected reference clock normalizes unsigned integer delta-seconds and
canonical HTTP-date (IMF-fixdate, GMT). Malformed dates, inconsistent weekdays,
negative/fractional/overflow values and invalid clocks are rejected. Obsolete
RFC 850/asctime date spellings are not accepted. Missing, invalid, past/equal
and valid values have distinct states; only a future valid value exposes an ISO
deadline and delay in milliseconds. Parsing applies to 503 as well as 429 and
is not mechanically restricted to rate limits.

`retryHint` is diagnostic, never an admission or scheduling decision. Future
A2.2 must compute effective due time from the maximum of local backoff, valid
provider deadline and quota constraints. This slice deliberately leaves the
existing quota/cadence implementation and persisted outcomes unchanged; its
old Retry-After scheduling limitations remain for A2.2.

## Transport evidence

Node `cause.code`, or direct `code`, is retained only as a bounded uppercase
identifier. DNS (`ENOTFOUND`, `EAI_AGAIN`), refused/reset connections and socket
errors fall under NETWORK_TRANSIENT. Unidentified fetch/read failures share
that category with an `unknown` hint: a message alone cannot prove a transient
network cause, TLS failure or redirect refusal.

`ETIMEDOUT`, `ESOCKETTIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`,
`UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT` and the transport's timer
abort map to TIMEOUT. A caller-aborted signal takes precedence and maps to
CALLER_ABORTED. An AbortError without caller cancellation retains the existing
timeout interpretation; its precise runtime origin cannot always be proved.

Only explicit certificate/TLS codes identify TLS_OR_SECURITY_FAILURE:
`CERT_HAS_EXPIRED`, `CERT_NOT_YET_VALID`, `DEPTH_ZERO_SELF_SIGNED_CERT`,
`SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`,
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `ERR_TLS_CERT_ALTNAME_INVALID`,
`ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED`, `ERR_SSL_WRONG_VERSION_NUMBER`.
The endpoint security guard uses the same security category. No string-message
guessing is performed. A body-read failure retains received HTTP context;
`Z_DATA_ERROR` during body reading is an encoding/payload failure. Legacy
transport codes (`network_error`, `timeout`, `aborted`) remain compatible with
existing quota accounting; the category supplies finer TLS/encoding evidence
without changing the persistent counter implementation.

## Accounting and propagation

Each authorized request attempts at most one outcome callback. Non-2xx uses
`afterResponse` once, with authoritative status and headers. A transport or
successful-response data failure uses `afterError` once. A callback exception
does not trigger a compensating outcome callback, so a possibly committed
charge is not accounted a second time. Existing charge-id idempotency remains
in the quota service. A declared gate `failureDomain: accounting` identifies
INTERNAL_ACCOUNTING_ERROR; other gate/counter exceptions identify
INTERNAL_CALLBACK_ERROR. Response-received/status context survives either.

Adapters propagate typed HTTP/configuration/payload errors. The acquisition
transaction preserves the original error, adds classification when absent and
retains its traversal identity. Its durable `acquisition_failed` outcome and
scheduler behavior remain unchanged. The one-shot error report exposes the
structured classification, making it available to future A2.2 consumers.

No classification is stored in `canonical_handoff_v1`. A1 handoff state and
offline recovery semantics are untouched. A2.2 durable counters/exhaustion,
A2.3 retry selection, A3 physical request guards/heartbeat (R1-P1-01), and A4
periodic acquisition remain separate work.

## Validation scope

Mock-only tests cover the HTTP matrix, non-JSON status preservation, 429/503
Retry-After, transport evidence, timeout/caller cancellation, body read/encoding,
callback accounting boundaries and adapter/transaction propagation. Relevant
quota/cadence, acquisition, scheduler and A1 regressions run only against owned,
disposable local PostgreSQL fixtures. No real provider request is required.

Observed implementation validation:

- 63 new mock-only unit cases passed; 2 new PostgreSQL charge-id cases passed
  (callback failure after committed 200/429, concurrent late outcomes).
- API suite: 599 passed, 91 PostgreSQL cases skipped by default. Dedicated
  local harnesses passed the 31 A1 handoff cases, 64 quota/cadence scenarios,
  acquisition transaction/orchestration/restart/temporality/correction and
  scheduler regressions, plus 40 normalization/publication PostgreSQL cases.
- Repository validation: 193 tests, 18 skips; workspaces typecheck and lint,
  API build and governance validator passed.
- All validation sources matched the candidate by content hash in an isolated
  copy using already available dependencies. Disposable database containers
  were removed. No real provider, credential, certification database, preprod
  or production access, worker/scheduler process, deployment or push occurred.

Self-audit: no new P1, unresolved A2.1-specific P2 or new P3 found. This is
implementation evidence, not a maintainer certification or broader A2 closure.
