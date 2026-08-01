# Cycle de vie d'une synchronisation

- requested
- queued
- acquiring_lock
- running
- rate_limited
- retry_wait
- partially_completed
- completed
- failed
- cancelled

## Règles
- `completed` implique que toutes les pages prévues ont été traitées.
- `partially_completed` implique des données utiles persistées mais un périmètre
  incomplet.
- `failed` ne doit pas effacer les observations déjà collectées.
- un run terminé est immuable hors annotations administratives.
