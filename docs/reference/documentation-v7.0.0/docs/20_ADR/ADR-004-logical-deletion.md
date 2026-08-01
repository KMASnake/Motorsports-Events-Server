# ADR-004 — Archivage logique

## Décision
Les entités métier référencées sont archivées plutôt que supprimées.

## Motif
Conserver l'intégrité historique et les publications antérieures.

## Conséquence
Les requêtes applicatives doivent filtrer explicitement les éléments archivés.
