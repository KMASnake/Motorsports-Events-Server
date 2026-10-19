# v8.1.0-alpha.2-lot.4 — Fondations MEDS

## Portée

Ce lot est volontairement limité. Il extrait les fondations du Design System
sans modifier l'organisation ni les fonctions métier des pages existantes.

## Livré

- tokens TypeScript centralisés ;
- composants `Button`, `IconButton`, `Card`, `Panel`, `MetricCard`,
  `Badge`, `StatusChip`, `ProgressBar`, `QualityBar`, `EmptyState` ;
- migration des composants partagés existants `Panel`, `Pill`, `Quality`
  et `Empty` vers MEDS ;
- feuille CSS dédiée aux composants ;
- port PostgreSQL hôte configurable, valeur par défaut `5433` ;
- scripts PowerShell de validation locale ;
- passation Codex et suivi d'avancement actualisés.

## Hors périmètre

- aucune refonte du Dashboard ;
- aucune migration de la Sidebar ou de la Topbar ;
- aucune nouvelle fonction métier ;
- aucune dépendance graphique supplémentaire ;
- aucun changement volontaire de rendu majeur.

## Critères d'acceptation

1. `web`, `api` et `postgres` compilent et démarrent.
2. Les trois services deviennent `healthy`.
3. Dashboard, Événements, Championnats et Synchronisations s'affichent.
4. La navigation reste fonctionnelle.
5. Le rendu ne présente pas de régression majeure par rapport à l'alpha.1.
