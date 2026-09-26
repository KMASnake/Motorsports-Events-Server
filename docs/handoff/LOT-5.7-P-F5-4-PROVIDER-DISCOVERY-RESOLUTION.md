# F5-4 — Provider discovery resolution

Statut : `MAINTAINER_VALIDATED`

## Certification mainteneur

- commit fonctionnel : `a79323c12076bda1824b9c8c7a2fc9613bf2ad33` ;
- tree fonctionnel : `4bea3e9b179cc3d438a435c1e76b0839e8874ec0` ;
- schema head : `0035_f5_provider_discovery_resolution` ;
- ré-audit mainteneur final : `PASS` ;
- Validate legacy Python server #272 : `SUCCESS` ;
- CI — Node target #541 : `SUCCESS` ;
- bloqueurs P1 : `NONE` ;
- bloqueurs P2 : `NONE` ;
- violations de périmètre : `NONE`.

Le premier audit mainteneur avait demandé la correction de trois points P2 :
liaison complète de l'idempotence au contenu de la décision, centralisation
fail-closed des transitions d'état et schéma positif strict pour le payload
discovery. Ces corrections ont été conservées et le ré-audit final les a
validées.

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
ne constitue aucune autorisation de commencer F5-5 et ne clôt pas F5 global.
