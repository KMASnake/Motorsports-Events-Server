# ADR-0023 — Taxonomie canonique extensible

Statut : candidat F5-1, en attente de validation mainteneur

Date : 2026-09-23

## Contexte

`championships.category` est un libellé historique libre. Il ne fournit ni
identité machine stable ni distinction fiable entre discipline et famille.
À l'inverse, `session_types` est déjà le référentiel global extensible décidé
par l'ADR-0012, tandis que l'ADR-0013 établit qu'Event, et non la table
historique `sessions`, est l'identité métier canonique d'une session.

## Décision

- `discipline_families` et `disciplines` portent chacun une clé machine stable,
  un libellé, un état actif et les timestamps usuels. Discipline référence sa
  famille ; `championships.discipline_key` est nullable et référence Discipline.
- `championships.category` est conservé sans transformation. Aucun libellé
  historique n'est converti automatiquement en discipline.
- `session_types` est réutilisé comme registre canonique de classification des
  Events. Aucune seconde table de types et aucune seconde identité Session ne
  sont créées.
- `events.category` reste la classification normalisée ; `session_title`
  reste le libellé libre et fidèle. Une classification ne renomme jamais ce
  libellé.
- Les clés canoniques sont des données respectant une syntaxe machine bornée.
  Les mappings de normalisation sont validés en base contre `session_types`,
  et non contre un enum SQL ou TypeScript fermé.

## Compatibilité

Les tables `sessions`, `session_types` et `session_corrections` restent
lisibles et inchangées structurellement. Les Events et mappings existants
restent valides. Une catégorie Event historique qui ne correspond pas à une
clé du registre est préservée et traitée comme `other` uniquement pour le
matching canonique ; sa valeur stockée n'est pas écrasée.

## Conséquences

Ajouter une discipline, une famille ou un type de session est une mutation de
données administrée et auditée, pas une migration de schéma. La phase F5-1 ne
crée ni saison canonique, ni Venue/Layout, ni discovery, ni nouveau matching,
ni reconciliation multi-provider, ni publication provider-first.
