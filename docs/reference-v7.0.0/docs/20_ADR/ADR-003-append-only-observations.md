# ADR-003 — Observations brutes append-only

## Décision
Les observations fournisseurs sont immuables et ajoutées sous forme de nouvelles
versions.

## Motif
Permettre la traçabilité, la comparaison et la reconstruction des décisions.

## Conséquence
Le volume de stockage doit être maîtrisé par une politique de rétention sans
détruire les preuves nécessaires.
