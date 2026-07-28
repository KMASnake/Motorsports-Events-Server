# ADR 0001 — Dépôts séparés

## Décision

Le serveur, le plugin MyBB et l’application Android sont développés dans trois
dépôts indépendants.

## Dépôts

- `motorsports-events-server`
- `motorsports-events-mybb`
- `motorsports-events-android`

## Raisons

- cycles de versions indépendants ;
- tests et releases séparés ;
- responsabilités mieux définies ;
- aucun couplage de build entre le serveur et les clients ;
- déploiements plus sûrs.

## Conséquence

L’API REST devient le contrat officiel entre les projets.
