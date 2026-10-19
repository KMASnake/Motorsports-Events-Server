# F5-2 — ChampionshipSeason canonique

Statut : `MAINTAINER_VALIDATED`

## Certification finale

- commit d'implémentation :
  `5f03705ba362f868017ed41b2c1278fb9a81ff08` ;
- schéma : `0033_f5_championship_seasons` ;
- ré-audit mainteneur final : `PASS` ;
- bloqueurs P1 : `NONE` ;
- bloqueurs P2 : `NONE` ;
- bloqueurs P3 : `NONE` ;
- Validate legacy Python server #268 : `SUCCESS` ;
- CI — Node target #537 : `SUCCESS`.

## Candidat livré

La migration linéaire `0033_f5_championship_seasons`, enfant de
`0032_f5_canonical_taxonomy`, ajoute le registre canonique UUID, son API admin
minimale auditée et un lien Meeting nullable protégé par une FK composite de
scope Championship.

La migration ne backfill aucune donnée. Les colonnes legacy restent intactes.
Le DOWN refuse toute suppression lorsqu'une édition ou un lien existe.

## Contrat d'identité

- UUID stable ;
- scope Championship ;
- `key` machine immuable après création et unique dans `(championship_id, key)` ;
- année, label et dates non identitaires ;
- saisons transannuelles et plusieurs éditions dans une année supportées.

`ChampionshipSeason` possède donc une identité UUID canonique stable. Sa
`key` est un handle machine stable, scoped au Championship et immuable. Le
lien `Meeting -> ChampionshipSeason` reste nullable et sa FK composite
garantit le scope Championship en base.

## Frontières

Provider, discovery, acquisition, matching, normalisation, publication et API
publique ne changent pas. Les identités UUID Meeting/Event sont préservées.
Les représentations legacy Championship, Meeting et provider season restent
conservées. F5 global reste `IN_PROGRESS`. F5-3 à F5-7 restent
`NOT_STARTED / NOT_AUTHORIZED`. Production reste `NOT_AUTHORIZED`.
