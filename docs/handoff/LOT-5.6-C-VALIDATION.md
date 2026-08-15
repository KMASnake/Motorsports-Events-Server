# Lot 5.6-C — Transaction d’unité et checkpoints

Date : 2026-08-15
Statut : **CORRIGÉ — RÉ-AUDIT MAINTENEUR REQUIS**

## Architecture

`AcquisitionTransactionService` ouvre ou reprend un traversal logique, appelle une unité de
l’adaptateur 5.6-B puis délègue le commit à `PersistentSchedulerService`.
Celui-ci verrouille le flux et vérifie propriétaire, génération de fencing et
expiration de lease avant d’exécuter dans une même transaction :

- upsert idempotent des entités source sanitizées ;
- observations `present` cumulées sur toutes les pages et, uniquement à
  complétude certaine, `not_observed` par différence sur le traversal entier ;
- journal des vrais changements de hash source ;
- anomalies item agrégées ;
- clôture du traversal ;
- clôture du run et avancement du checkpoint.

Une erreur structurelle est conservée comme traversal/anomalie d’échec sans
avancer le checkpoint. Une erreur PostgreSQL, un crash avant commit, un fencing
stale ou une lease perdue ne laisse ni entité partielle ni checkpoint avancé.
Un `cursor_invalid` conserve le checkpoint et passe par le mécanisme d’échec
transitoire 5.4.

La récupération 5.4 clôt aussi comme `failed` les traversals `running` dont la
lease a expiré, sans créer de preuve de complétude. La migration additive
`0017_lot56_durable_parent_reference` conserve la référence parent externe et
son type jusqu’à ce que le parent exact soit observable dans le même périmètre.
`strTimestamp` est exclusivement une date de début ; aucune fin n’est inventée.

## Overrides

L’acquisition n’écrit jamais dans les corrections. Lorsqu’un lien fournisseur
historique existant permet d’identifier un Événement corrigé, le changement
source porte `manual_override_active=true`. La concurrence source/override est
testée sans créer de nouveau rapprochement métier.

## Preuves

Commande : `./scripts/test-lot56-transaction.sh`

- PostgreSQL réel jetable et migrations jusqu’à 0017 avec cycle up/down/up : PASS ;
- traversal A/B puis C/D, OLD seul absent et échec page 2 sans absence : PASS ;
- clôture des échecs interceptables et récupération d’un traversal orphelin : PASS ;
- parents tardifs, typés, cross-scope refusés et rejeu idempotent : PASS ;
- `strTimestamp`, fin explicite et dates 1900/1950/1969 : PASS ;
- typecheck API : PASS ;
- build API : PASS ;
- suite API complète : 191/191 PASS ;
- validation historique du dépôt : PASS.

## Frontière

Aucune normalisation, fusion d’identité, suppression métier ou orchestration
5.6-D n’est implémentée. STOP avant 5.6-D. Le Lot 5.6 global reste non validé,
`merge_authorized=false`, `authorized_sub_lot=5.6`, et 5.7+ restent interdits.
