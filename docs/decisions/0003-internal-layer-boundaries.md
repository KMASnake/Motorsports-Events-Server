# ADR 0003 — Séparation progressive des couches internes

## Statut

Accepté pour le jalon 2.

## Décision

Le serveur est progressivement organisé en quatre couches :

- `domain` : modèles normalisés et règles métier pures ;
- `application` : orchestration des cas d’usage, notamment la synchronisation ;
- `infrastructure` : persistance SQLAlchemy et futurs adaptateurs techniques ;
- `api` : filtres et représentation HTTP.

Les modules historiques (`models.py`, `database.py`, `sync_service.py` et
`session_classification.py`) restent disponibles comme façades de compatibilité.

## Contraintes

- aucune route HTTP n’est renommée ;
- aucun champ JSON public n’est modifié ;
- aucun schéma SQL ni nom de table n’est modifié ;
- les providers conservent leur interface `fetch(season)` ;
- les séances `race` et `sprint` restent considérées comme des courses.

## Validation

Des tests de non-régression couvrent la classification des séances, les filtres
publics et la présence des façades de compatibilité.
