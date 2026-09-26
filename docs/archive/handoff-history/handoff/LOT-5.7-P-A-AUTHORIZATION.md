# Lot 5.7-P-A — Maintainer authorization

Date : 2026-08-21  
Decision : **AUTHORIZED FOR IMPLEMENTATION**  
Parent : **5.7-P**  
Parent technical design : **MAINTAINER VALIDATED**

## Gate

**Normalized identity and persistence foundations**

Add only the permanent persistence and repository foundations required by
5.7-P, without normalizing or publishing data.

## In scope

- precise inventory and reuse of the existing schema ;
- minimal Meeting persistence and Meeting↔Event relation ;
- durable Event and Meeting source links ;
- normalized candidate, normalization decision and checkpoint persistence ;
- stable UUID, tombstone, uniqueness, FK and concurrency constraints ;
- additive PostgreSQL migrations with safe down paths ;
- domain/application repository contracts and PostgreSQL repositories ;
- focused migration, repository, race, architecture and pre-1970 tests ;
- complete 5.6 non-regression proof.

## Acceptance

- PP-T01 through PP-T06 ;
- relevant PP-001 through PP-009 ;
- relevant PP-024 through PP-036.

The future evidence must cover fresh/current PostgreSQL, down/up, preserved
data, FK and uniqueness constraints, stable UUID/source-link/candidate and
checkpoint constraints, concurrent races, repositories, pre-1970 timestamps,
architecture boundaries, no added public route and full 5.6 non-regression.

## Out of scope

No normalization engine, provider mapping, matching/scoring, automatic identity
decision, functional review workflow, normalized corrections/presence/
finalization, promotion, publication, last-known-good, functional public state
or change log, Preview API, client route, `/api/v1/changes`, client auth/API
keys/scopes/entitlements/quotas/rate limits, ACP clients, onboarding, external
visibility or launch is authorized.

The global design may name tables owned by later gates; that does not authorize
their implementation in A. After A: public client routes, client auth,
publication and external visibility remain **NONE**.

## Stop rule

STOP after implementation, evidence and handoff for maintainer audit. Do not
open or start 5.7-P-B automatically.

5.7-P-B through 5.7-P-F: **UNAUTHORIZED**  
Full 5.7: **UNAUTHORIZED**  
Lot 5.8+: **UNAUTHORIZED**  
Merge main: **UNAUTHORIZED**
