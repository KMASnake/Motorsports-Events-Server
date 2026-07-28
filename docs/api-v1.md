# Contrat API v1

`/api/v1` est le contrat stable entre le serveur et les clients MyBB ou
Android. Les réponses utilisent JSON et les dates utilisent ISO 8601 avec un
fuseau horaire.

## Authentification

Les routes publiques de données attendent :

```http
X-API-Key: <PUBLIC_API_KEY>
```

La clé d'administration ne doit jamais être distribuée à un client.

## Découverte

- `GET /api/v1/version` : version du serveur, build et commit ;
- `GET /api/v1/health` : état élémentaire de l'API ;
- `GET /api/v1/sports` : sports activés.

## Synchronisation complète

`GET /api/v1/events` renvoie les épreuves et leurs séances. Les filtres
existants restent disponibles :

- `from` et `to` ;
- `season` ;
- `sports` ;
- `session_types` ;
- `categories` ;
- `statuses` ;
- `is_race` ;
- `include_cancelled` ;
- `include_deleted`.

Un client initialise son stockage local avec cette route. Une séance supprimée
par un provider reste consultable avec `include_deleted=true`.

## Synchronisation différentielle

Le premier appel utilise une date connue :

```http
GET /api/v1/events/changes?since=2026-01-01T00:00:00Z&limit=500
```

La réponse contient :

- `updated` : séances créées, modifiées ou marquées supprimées ;
- `cursor` : curseur opaque pour l'appel suivant ;
- `next_cursor` : date conservée pour les anciens clients ;
- `has_more` : indique qu'une autre page du même instantané existe ;
- `snapshot_at` : limite stable de l'instantané en cours.

Pour toutes les requêtes suivantes, le client transmet uniquement `cursor` :

```http
GET /api/v1/events/changes?cursor=<cursor>&limit=500
```

Tant que `has_more` vaut `true`, le client continue immédiatement. Lorsqu'il
vaut `false`, il conserve le dernier `cursor` pour la prochaine
synchronisation. Le curseur ne doit pas être interprété ni modifié.

L'API répond `503 Service Unavailable` lorsqu'une synchronisation serveur est
en cours. Si une synchronisation commence entre deux pages, l'ancien curseur
reçoit `409 Conflict`. Le client attend alors la fin de la synchronisation et
recommence depuis son dernier `since` confirmé. Aucune page partielle ne doit
être validée après un `409` ou un `503`.

Un client historique peut continuer à transmettre `since` et à conserver
`next_cursor`. Le curseur opaque est recommandé, car il départage sans perte
plusieurs changements portant exactement le même horodatage.

## Suppressions

La synchronisation différentielle ne retire jamais implicitement une ligne.
Une séance dont `deleted` vaut `true` doit être supprimée du calendrier du
client ou masquée selon sa politique locale.

## OpenAPI

Les schémas de réponses sont déclarés explicitement dans FastAPI et consultables
sur `/docs` ou `/openapi.json`. Les champs existants de `/api/v1` ne sont pas
retirés ni renommés pendant la série serveur 2.x.
