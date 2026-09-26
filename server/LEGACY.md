# Legacy backend — frozen

Le répertoire `server/` contient l’ancienne génération du backend Motorsports Events : Python, FastAPI, SQLAlchemy et Alembic.

## Statut

**LEGACY / FROZEN**

Ce code reste temporairement dans le dépôt parce que la production historique n’a pas encore terminé son cutover vers l’architecture Node/PostgreSQL située sous `apps/api` et `apps/web`.

## Règles

Jusqu’au cutover :

- ne pas ajouter de nouvelle fonctionnalité métier dans `server/` ;
- ne pas y ajouter de nouveau provider ;
- ne pas créer de nouvelle divergence fonctionnelle avec l’API Node ;
- limiter les modifications aux correctifs indispensables au maintien de la production legacy ;
- documenter tout correctif legacy comme temporaire et non comme architecture cible.

## Architecture cible

La cible officielle est documentée dans `docs/architecture.md`.

Le pipeline provider et son modèle d’états sont documentés dans `docs/provider-state-model.md`.

## Suppression future

Après cutover Production Node validé et rollback certifié, un lot dédié pourra retirer ensemble :

- `server/app/**` ;
- `server/alembic/**` ;
- `server/requirements.txt` ;
- `server/Dockerfile` ;
- les tests métier Python qui imposent encore ce backend ;
- les configurations proxy/runtime exclusivement liées au serveur Python.

Cette suppression ne doit pas être faite fichier par fichier avant le cutover, afin de conserver une capacité de rollback complète.
