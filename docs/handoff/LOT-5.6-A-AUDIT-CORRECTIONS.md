# Lot 5.6-A — Corrections après audit mainteneur

Date : 2026-08-15  
Statut : **CORRIGÉ — EN ATTENTE DE RÉ-AUDIT MAINTENEUR**

## P1 — Cycle de vie des anomalies

L'unicité `(provider_championship_id, anomaly_key, state)` est supprimée.
Un index unique partiel garantit une seule occurrence active par clé et par
championnat, tandis que les occurrences résolues historiques restent illimitées.

Preuve PostgreSQL :

`active → resolved → active → resolved → active`.

## P1 — Non-observation durable

`provider_source_observations.observation_kind` distingue explicitement :

- `present` ;
- `not_observed`.

Un trigger PostgreSQL interdit `not_observed` lorsque le traversal n'est pas
complet et vérifie que traversal et entité appartiennent au même périmètre
championnat fournisseur. Cette observation n'entraîne aucune suppression,
annulation, dépublication ou décision métier 5.7.

## P2 — Sanitization

Les noms de clés sont canonicalisés en minuscules alphanumériques avant
comparaison. Snake case, kebab case, camelCase et casse arbitraire convergent
donc vers la même clé sensible. Les URL avec user/password ou paramètre de
requête sensible sont refusées.

Les tests canaris vérifient le résultat sérialisé, pas uniquement sa structure.

## P2 — Cohérence relationnelle

Une FK composite garantit la cohérence entre `provider_instance_id` et
`provider_championship_id`. Une seconde FK composite garantit qu'un parent et
son enfant appartiennent exactement au même périmètre fournisseur/championnat.

## Gate

- 5.6-A : corrigé, en attente de ré-audit ;
- 5.6-B : non commencé ;
- `maintainer_validated` : inchangé à `false` ;
- fusion dans `main` : non autorisée ;
- 5.7+ : non autorisés.

