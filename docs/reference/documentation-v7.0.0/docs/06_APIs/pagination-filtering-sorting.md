# Pagination, filtres et tri

## Pagination
- `page` >= 1
- `pageSize` entre 1 et 100
- défaut recommandé : 25

Réponse : `items`, `page`, `pageSize`, `totalItems`, `totalPages`.

## Tri
- `sort`
- `order` : `asc` ou `desc`

## Filtres communs
`status`, `from`, `to`, `championshipId`, `seasonId`, `countryCode`,
`updatedSince`.

Un filtre inconnu doit retourner 400.
