# Historisation et versioning

## État courant
Les tables canoniques portent l'état courant.

## Historique
Les changements significatifs sont conservés par :
- audit_entries ;
- merge_decisions ;
- corrections et overrides ;
- publication_snapshots.

## Concurrence
Une colonne `version` ou mécanisme équivalent doit empêcher l'écrasement
silencieux d'une modification concurrente.

## Snapshots
Un snapshot publié ne doit jamais changer. Une nouvelle publication crée un
nouveau snapshot.
