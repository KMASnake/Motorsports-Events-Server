# F5-7B — Publication canonique versionnée

Statut : `IMPLEMENTED_PENDING_MAINTAINER_AUDIT`.

F5-7B étend le journal public existant sans créer de pipeline parallèle. Les
ressources `championship`, `championshipSeason`, `venue`, `venueLayout`,
`meeting` et `event` partagent `public_resource_states`,
`public_resource_versions`, `public_change_log`, leurs révisions monotones et
leurs tombstones permanents.

## Identités et source

- Championship : UUIDv8 déterministe F5-7A dérivé de l'ID canonique texte ;
  `legacy_id` reste publié.
- ChampionshipSeason : `championship_seasons.id` ; l'année ne participe pas à
  l'identité et plusieurs éditions de la même année restent distinctes.
- Venue : `venues.id`.
- VenueLayout : `venue_layouts.id`, avec son `venue_id` canonique.
- Meeting : `meetings.id`.
- Event : `events.normalized_uuid`.

Le service de catalogue, appelé dans la transaction des mutations admin
Championship, ChampionshipSeason, Venue et VenueLayout, lit exclusivement les lignes canoniques persistées et
leurs relations canoniques. Il ne lit ni observation fournisseur, ni candidat
de discovery/normalisation, ni contribution perdante, ni payload source. Les
Meeting/Event continuent de passer par la matérialisation effective F5-6.
Les créations provider-first canoniques utilisent le même service, sans
publier observation ou candidat. L'établissement initial idempotent des lignes
pré-0038 est explicitement gardé par `F57B_ESTABLISH=authorized`, exige le head
0038 et ne réalise aucun appel fournisseur.

## Versionnement

Un checksum déterministe de l'état effectif rend un replay identique sans
effet. Une mutation effective écrit au plus un état, une version immuable et
un changement dans la même transaction. Les séquences existantes ne sont ni
réécrites ni réinitialisées. Les nouvelles ressources apparaissent dans le
journal `/changes` existant et utilisent les mêmes cursors/snapshots.

La certification PostgreSQL jetable exécute le service réel et prouve replay,
mutation, rollback transactionnel injecté, journal/version atomiques, retrait
et non-résurrection après tombstone. La migration `0038_f5_canonical_publication` modifie uniquement les contraintes
de type des trois tables de publication. Son DOWN accepte une capacité encore
inutilisée et refuse dès qu'un état, une version ou un changement F5-7B existe.

## Accès et compatibilité

Les ChampionshipSeason utilisent le scope `championships:read` et les droits
Championship existants. Venue et VenueLayout sont des catalogues globaux mais
restent authentifiés, contingentés et protégés par `meetings:read`. Les
Meeting/Event et `/changes` conservent leurs scopes et entitlements existants.
Les routes et identités legacy restent inchangées.

F5-7C, F5-7D, l'activation provider, la préproduction, la Production et tout
déploiement restent hors périmètre et non autorisés.
