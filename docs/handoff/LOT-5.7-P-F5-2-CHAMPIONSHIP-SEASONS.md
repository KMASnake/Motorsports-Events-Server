# F5-2 — ChampionshipSeason canonique

Statut : `IN_PROGRESS_PENDING_MAINTAINER_VALIDATION`

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

## Frontières

Provider, discovery, acquisition, matching, normalisation, publication et API
publique ne changent pas. F5-3 à F5-7 restent `NOT_STARTED / NOT_AUTHORIZED`.
Production reste `NOT_AUTHORIZED`. Ce document ne valide pas F5-2 : une
décision mainteneur séparée reste obligatoire.
