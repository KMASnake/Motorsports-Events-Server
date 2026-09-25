# F5-4 — Provider discovery resolution

Statut : `IMPLEMENTED_AWAITING_MAINTAINER_VALIDATION`

## Périmètre livré

- migration linéaire `0035_f5_provider_discovery_resolution` ;
- observations de discovery immuables et bornées ;
- candidats persistés et versionnés Championship + ChampionshipSeason ;
- source links durables indépendants de l'activation ;
- décisions admin append-only avec révision attendue et idempotence liée au fingerprint canonique de la requête ;
- machine d'état contrôlée centralement et payload discovery soumis à un schéma positif strict Championship/Season/catalogue ;
- API admin list/detail/decision ;
- certification PostgreSQL isolée et fixtures sans réseau.

## Identité et sécurité

`championships.id` et `championship_seasons.id` restent les identités
canoniques. External IDs, noms, labels et années ne le sont jamais. Une année
seule ne résout pas une Season. Les ambiguïtés restent en review.

La résolution ne crée aucun `provider_championship`, `sync_stream` ou run
d'acquisition. Elle ne démarre ni worker ni scheduler et ne touche pas la
publication. `provider_championships` reste une configuration opérationnelle,
pas un source link canonique.

## Bornes

F5-5, F5-6 et F5-7 restent `NOT_STARTED_NOT_AUTHORIZED`. Aucun appel provider,
crédit, accès préproduction/production ou déploiement n'est autorisé. Ce statut
ne vaut pas validation mainteneur de F5-4.
