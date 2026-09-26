# F5-3 — Canonical Venue/Layout

Statut : `MAINTAINER_VALIDATED`.

Preuve de clôture :

- commit fonctionnel : `dc34c2ca192a7fa58768ab048a86036ebf63f847` ;
- tree fonctionnel : `a170c3b54acec9fdef008d82552c080069858911` ;
- migration : `0034_f5_canonical_venues` ;
- ré-audit mainteneur final : `PASS` ;
- bloqueurs P1/P2/P3 : `NONE` ;
- violations de périmètre : `NONE` ;
- Validate legacy Python server #270 : `SUCCESS` ;
- CI — Node target #539 : `SUCCESS`.

Ce candidat introduit la migration linéaire
`0034_f5_canonical_venues`, fille de `0033_f5_championship_seasons` :

- registre extensible `venue_kinds` ;
- identité canonique `venues` avec UUID stable et key globale immuable ;
- `venue_layouts` avec UUID stable et key immuable scoped au Venue ;
- mapping explicite et restrictif `circuit_venue_links`.

## Garanties du candidat

- aucun backfill Circuit → Venue ;
- aucune modification structurelle de `circuits`, `meetings` ou `events` ;
- aucune référence Venue/Layout sur Meeting ou Event ;
- validation IANA des timezones à la frontière API admin ;
- coordonnées nullable par paire et bornées ;
- FK composite interdisant un Layout d'un autre Venue ;
- keys protégées à l'API et en base ;
- administration list/create/get/update sans DELETE destructif ;
- audit administratif écrit dans la même transaction que les mutations ;
- DOWN refusé avant tout DDL en présence de données ou dépendances futures.

## Frontières

Meeting/Event et provenance provider restent F5-5. Les aliases et la
réconciliation restent F5-6. Publication et API publique restent F5-7. Le cas
WRC `location == circuit` est explicitement non résolu ici.

L'UUID Event reste l'identité stable de la Session ; F5-3 ne modifie ni cette
identité ni sa projection Meeting/Event.

F5-1 et F5-2 restent `MAINTAINER_VALIDATED`. F5-4 à F5-7 restent
`NOT_STARTED_NOT_AUTHORIZED`. F5 global reste `IN_PROGRESS` et Production
reste `NOT_AUTHORIZED`.

Cette clôture n'autorise pas F5-4. Aucun appel provider, worker, scheduler,
déploiement ou mutation de préproduction/production n'est autorisé.
