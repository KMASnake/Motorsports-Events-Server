# ADR-025 — Catégorie facultative et rattachement des saisons

## Décision
`Season` conserve `championshipId` obligatoire et `categoryId` nullable.

## Conséquences
Une saison sans catégorie est directement rattachée au championnat. Une saison catégorisée doit
référencer une catégorie du même championnat. Aucune catégorie artificielle n'est créée.
