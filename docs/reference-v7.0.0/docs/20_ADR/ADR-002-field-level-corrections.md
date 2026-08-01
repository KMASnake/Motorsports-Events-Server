# ADR-002 — Corrections au niveau du champ

## Décision
Une correction cible un champ précis et produit un override indépendant.

## Motif
Une erreur de date ne doit pas empêcher la mise à jour d'autres champs fiables.

## Conséquences
- Historique plus fin.
- Réversion possible champ par champ.
- Résolution explicite des overrides concurrents.
