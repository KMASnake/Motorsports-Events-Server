# ADR-0026 — Résolution provider-first Championship et ChampionshipSeason

Statut : candidat F5-4, en attente de validation mainteneur.

## Décision

La discovery conserve d'abord une observation immuable de ce que la source a
déclaré. Une projection candidate séparée normalise ensuite Championship et
ChampionshipSeason, sans confondre external ID, nom, label ou année avec une
identité canonique.

Les liens `championship_source_links` et
`championship_season_source_links` sont les associations durables entre
identités source et canoniques. `provider_championships` reste une
configuration opérationnelle d'activation/acquisition et n'est pas la preuve
source canonique F5-4.

Une ambiguïté impose une review. La création d'un Championship ou d'une Season
est une décision administrative explicite, atomique et auditée. Les décisions
et observations sont append-only. L'année est une métadonnée, jamais une
identité Season.

Chaque clé d'idempotence est liée au fingerprint canonique de la requête
logique complète. Une réutilisation incohérente est refusée. La machine d'état
est contrôlée centralement et les payloads suivent une allowlist stricte de
données Championship, Season et catalogue.

## Séparation d'exécution

Discovery et résolution ne peuvent activer ni provider, ni Championship, ni
scheduler, ni acquisition. Elles ne créent ni `provider_championships`, ni
`sync_streams`, et ne publient aucune ressource. Les tests F5-4 utilisent
uniquement des fixtures locales injectées ; tout appel provider est interdit.

## Frontières

- F5-5 : résolution Meeting/Event et références canoniques associées ;
- F5-6 : aliases et réconciliation multi-provider ;
- F5-7 : activation, appels provider contrôlés et publication publique.

F5-4 ne modifie ni la normalisation Meeting/Event ni la publication existante.
