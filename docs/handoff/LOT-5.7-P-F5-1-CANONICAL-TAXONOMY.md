# F5-1 — Fondations de taxonomie canonique

Statut : `MAINTAINER_VALIDATED`

## Validation mainteneur

- audit final : `PASS` ;
- bloqueurs P1/P2/P3 : `NONE` ;
- commit : `3e80099d56ff85df6eebe6b84d615a89180e12e9` ;
- tree : `34c8a030e3a5d8af2bda71421eba31cf4f7d1114` ;
- schema head : `0032_f5_canonical_taxonomy` ;
- Validate legacy Python server #266 : `SUCCESS` ;
- CI — Node target #535 : `SUCCESS`.

Cette validation clôt uniquement F5-1. F5 reste `IN_PROGRESS` et aucune
sous-phase F5-2 à F5-7 n'est autorisée.

## Périmètre candidat

F5-1 réutilise `session_types` comme registre de classification extensible et
ajoute les registres minimaux `discipline_families` et `disciplines` parce que le libellé libre
`championships.category` ne constitue pas une identité canonique.

Le modèle respecte les séparations suivantes :

- Event demeure l'identité métier canonique d'une Session ;
- `session_title` demeure un libellé libre ;
- `events.category` demeure la classification normalisée ;
- les tables Sessions de l'ADR-0012 restent une compatibilité historique ;
- `championships.category` est conservé, sans backfill ambigu ;
- `championships.discipline_key` est nullable et contrôlé par le registre.

## Données initiales

Le registre Session couvre au minimum `practice`, `practice_1`, `practice_2`,
`practice_3`, `qualifying`, `sprint_qualifying`, `sprint`, `warmup`, `race`,
`test`, `stage`, `special_stage` et `other`. Les nouveaux types sont des lignes
de référence, jamais des valeurs d'un enum SQL fermé.

Les disciplines initiales sont `single_seater`, `motorcycle_racing`, `rally`
et `endurance`. Leur `family_key` référence le registre extensible des familles.
Aucune discipline n'est déduite des catégories historiques.

## Frontières

F5-2 à F5-7 restent `NOT_STARTED / NOT_AUTHORIZED`. Aucun modèle Season,
Venue/Layout, discovery, auto-création Championship, matching provider-first,
reconciliation multi-provider ou nouvelle publication provider-first n'est
introduit. Production reste `NOT_AUTHORIZED`.
