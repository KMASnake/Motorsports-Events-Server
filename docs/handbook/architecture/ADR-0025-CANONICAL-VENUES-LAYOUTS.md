# ADR-0025 — Canonical Venue and VenueLayout

Statut : candidat F5-3, en attente de validation mainteneur.

## Décision

Un `Venue` est le lieu canonique stable. Son UUID est identitaire et sa `key`
globale est immuable. Son nom, son type, sa localisation, son fuseau et ses
coordonnées sont des métadonnées modifiables, jamais des composantes de son
identité.

Un `VenueLayout` est une configuration ou route concrète subordonnée à un
Venue. Son UUID est stable et sa `key` est immuable dans le périmètre de son
Venue. Un Layout n'est ni un Meeting, ni un Event, ni une Session, ni un
Result.

Le registre `venue_kinds` est extensible et piloté par les données. Il n'est
pas un enum SQL fermé. Le modèle couvre notamment circuit permanent, circuit
urbain, lieu ou parc de rallye, lieu de spéciale et piste d'essais.

## Compatibilité Circuit

`circuits` reste le registre historique intact. Un mapping explicite
`circuit_venue_links` peut relier un Circuit à un Venue et, facultativement, à
un Layout appartenant à ce même Venue. Aucune inférence et aucun backfill ne
sont autorisés : un Circuit sans mapping et un Venue sans Circuit sont valides.

Le modèle ne confond donc jamais `Venue`, `Circuit` et `VenueLayout`. En
particulier, les données WRC où une location fournisseur a historiquement été
traitée comme un circuit ne sont pas corrigées dans F5-3.

## Frontières différées

- références Meeting/Event, provenance provider et résolution WRC : F5-5 ;
- aliases et réconciliation multi-provider : F5-6 ;
- publication et API publique : F5-7.

F5-3 n'ajoute aucun source link, ne modifie aucune normalisation et ne publie
aucune ressource Venue/Layout.
