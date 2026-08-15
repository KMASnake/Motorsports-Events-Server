# Lot 5.6-C — Transaction d’unité et checkpoints

Date : 2026-08-15
Statut : **IMPLÉMENTÉ — AUDIT MAINTENEUR REQUIS**

## Architecture

`AcquisitionTransactionService` ouvre un traversal, appelle une unité de
l’adaptateur 5.6-B puis délègue le commit à `PersistentSchedulerService`.
Celui-ci verrouille le flux et vérifie propriétaire, génération de fencing et
expiration de lease avant d’exécuter dans une même transaction :

- upsert idempotent des entités source sanitizées ;
- observations `present` et, uniquement à complétude certaine,
  `not_observed` ;
- journal des vrais changements de hash source ;
- anomalies item agrégées ;
- clôture du traversal ;
- clôture du run et avancement du checkpoint.

Une erreur structurelle est conservée comme traversal/anomalie d’échec sans
avancer le checkpoint. Une erreur PostgreSQL, un crash avant commit, un fencing
stale ou une lease perdue ne laisse ni entité partielle ni checkpoint avancé.
Un `cursor_invalid` conserve le checkpoint et passe par le mécanisme d’échec
transitoire 5.4.

## Overrides

L’acquisition n’écrit jamais dans les corrections. Lorsqu’un lien fournisseur
historique existant permet d’identifier un Événement corrigé, le changement
source porte `manual_override_active=true`. La concurrence source/override est
testée sans créer de nouveau rapprochement métier.

## Preuves

Commande : `./scripts/test-lot56-transaction.sh`

- PostgreSQL réel jetable et migrations jusqu’à 0016 : PASS ;
- 18 scénarios transactionnels obligatoires : PASS ;
- typecheck API : PASS ;
- build API : PASS ;
- suite API complète : 191/191 PASS ;
- validation historique du dépôt : PASS.

## Frontière

Aucune normalisation, fusion d’identité, suppression métier ou orchestration
5.6-D n’est implémentée. STOP avant 5.6-D. Le Lot 5.6 global reste non validé,
`merge_authorized=false`, `authorized_sub_lot=5.6`, et 5.7+ restent interdits.
