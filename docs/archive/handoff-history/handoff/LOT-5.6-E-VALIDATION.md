# Lot 5.6-E — Temporalité et finalization

Date : 2026-08-21  
Statut : **RÉ-AUDIT MAINTENEUR PASS — VALIDÉ LE 2026-08-21**

## Critères couverts

- AC-5.6-020/021/023 : futur au-delà de J+30, fenêtre hot civile, UTC, fuseau
  explicite, minuit, DST été/hiver, workers indépendants du TZ système et
  dates 1900/1950/1969 ;
- AC-5.6-030/031 : file finalization 0021 et fairness 5.4 préservées ;
- AC-5.6-040/041/042 : grâce configurable, hiérarchie unique de fin théorique,
  trace persistée et anomalie idempotente à l’échéance exacte ;
- AC-5.6-070 à 074 : recalcul et anomalie dans le commit durable avec leases,
  fencing, checkpoint et rejeu existants ;
- AC-5.6-092 : anomalie liée à l’entité, résoluble et non dupliquée ;
- AC-5.6-100 à 102 : aucune hypothèse de timestamp positif ni sentinelle zéro.

`cancelled`/`canceled` sont des états finaux fiables sans mutation vers
`completed`. Un statut `postponed` reste non final : la nouvelle date source
recalcule la fin théorique et résout l’anomalie devenue obsolète.

## Persistance

La migration additive `0022_lot56_temporality_finalization` ajoute
`provider_source_entities.end_estimation_details`, JSON borné contenant selon
la méthode : provenance, taille et durées de l’échantillon, règle adaptateur,
durée calculée, fuseau civil et `logic_version=lot56-e-v1`.

La migration 0021 reste l’unique file durable. Aucun scheduler, modèle métier,
API ou stockage concurrent n’est ajouté.

## Preuves exécutées

- typecheck, lint et build API : PASS ;
- test ciblé `acquisitionOrchestrator.test.ts` : 11/11 PASS ;
- suite API : 202/202 PASS ;
- `test-lot56-temporality.sh` : PASS sur PostgreSQL réel jetable, migration
  0022 down/up, `completed` avant grâce sans anomalie à T+29, T+30 et après
  T+30, idempotence, résolution, cancelled, postponed et trace ;
- le même script lance deux processus Node successifs : le premier persiste le
  curseur/traversal 2025 et quitte, le second recrée l’orchestrateur depuis
  PostgreSQL, reprend 2026 et vérifie absence de perte et de doublon ;
- `test-lot56-transaction.sh` : PASS ;
- `test-lot56-orchestration.sh` : PASS ;
- `test-lot54-scheduler.sh` : PASS, fairness/fencing et migrations ;
- `test-lot55-quota-cadence.sh` : 61 cas PASS, aucune requête fournisseur et
  aucun crédit consommé.

## Frontière

La matrice de preuve atteint 35 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED. Le
ré-audit mainteneur est PASS et 5.6-E est validé le 2026-08-21. Le gate suivant
autorise uniquement l’implémentation de 5.6-F — protection des corrections et
observations — sans qu’elle soit commencée dans cette mission. Le Lot 5.6
global reste non validé, `merge_authorized=false`, et les Lots 5.7/5.7-P et
suivants restent non autorisés.
