# 8.1.0-alpha.2-lot.4

Cette révision corrige la suppression depuis l’interface Web.

## Cause

Le client HTTP ajoutait systématiquement :

```http
Content-Type: application/json
```

même pour une requête `DELETE` sans corps. Fastify répondait alors :

```text
FST_ERR_CTP_EMPTY_JSON_BODY
```

## Correction

Le header JSON n’est désormais ajouté que lorsqu’un `body` est réellement présent.

## Validation

1. Reconstruire le frontend avec `reset-dev.cmd`.
2. Ouvrir la page Championnats.
3. Créer un championnat temporaire sans événement.
4. Le supprimer depuis l’interface.
5. Vérifier qu’aucun message `Body cannot be empty...` n’apparaît.
6. Exécuter `scripts\test-lot3.cmd`.
