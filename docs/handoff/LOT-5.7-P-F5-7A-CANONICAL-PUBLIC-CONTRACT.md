# F5-7A — Contrat public canonique

Statut : `IMPLEMENTED_PENDING_MAINTAINER_AUDIT`.

F5-7A définit le contrat additif consommable par MyBB, Android et Apple. Il
n'active ni provider, ni Preview Production, ni nouvelle ressource persistée.
La publication versionnée de ChampionshipSeason, Venue et VenueLayout reste le
périmètre distinct de F5-7B.

## Identités

| Ressource | Identité publique canonique | Compatibilité |
| --- | --- | --- |
| Championship | UUID déterministe version 8 dérivé exclusivement de `championships.id` et de l'espace de noms public versionné | `championships.id` texte demeure `legacy_id`; les routes legacy ne changent pas |
| ChampionshipSeason | `championship_seasons.id` UUID | année, label et dates ne sont pas identitaires |
| Venue | `venues.id` UUID | `circuits.id` reste une identité legacy séparée |
| VenueLayout | `venue_layouts.id` UUID | toujours scoped par `venue_id` |
| Meeting | `meetings.id` UUID | aucune identité provider n'est exposée |
| Event/session | `events.normalized_uuid` UUID | `/api/v1/events` legacy continue d'utiliser `events.id` lorsque Preview est OFF |

L'UUID Championship est stable pour une même clé canonique et distinct pour
deux clés différentes. Il ne dépend ni d'un provider, ni de son external ID,
ni de l'ordre d'acquisition. F5-7B devra persister exactement cette identité
dans l'historique public; il ne pourra pas substituer un ID provider.

## Représentation

Le module `apps/api/src/public/canonicalPublicContract.ts` est l'autorité de
sérialisation F5-7A. Les projections Meeting et Event exposent :

- l'ancien `championship.id` texte inchangé et son additif
  `championship.canonical_id` UUID ;
- `championship_season_id` ;
- `venue_id` et `venue_layout_id` canoniques ;
- `legacy_circuit_id` et l'ancien objet `venue` uniquement pour compatibilité ;
- les instants `starts_at` et `ends_at`, accompagnés de `timezone` ;
- pour Event, `meeting_id`, `session.type_key`, `session.title` et `status`.

Les alias historiques `session.type` et `session.name` sont conservés. Ils ont
exactement les mêmes valeurs que `type_key` et `title`. Un Venue canonique
n'est jamais réduit à `circuitId`.

ChampionshipSeason, Venue, VenueLayout et SessionType disposent dès F5-7A de
schémas et sérialiseurs stricts. Leur branchement aux routes et à
`public_resource_versions` attend F5-7B et, si autorisée, la migration 0038.

La relation canonique `meeting_id` des Events est ajoutée à l'état JSON déjà
publié lors d'une promotion Event. Elle provient exclusivement de la relation
canonique résolue et verrouillée par le service de publication ; elle ne crée
ni type de ressource persistée ni migration. Les réponses OpenAPI des routes
Championship, Meeting et Event référencent directement leurs schémas typés.
Les éventuelles sessions imbriquées d'un Meeting passent par une whitelist
stricte et ne peuvent contenir de provenance ou payload provider.

## Statuts et temps

Le domaine public canonique des Events est exactement : `scheduled`,
`confirmed`, `postponed`, `cancelled`, `completed`. Le filtre Preview accepte
les cinq valeurs. `draft` reste un état administratif non publié.

Les timestamps publics sont des instants ISO 8601 absolus. Conformément à
l'ADR-0004, la projection Event/Meeting conserve `timezone="UTC"` pour
compatibilité. Une conversion `Europe/Paris` appartient au client et ne change
jamais l'identité ni le stockage canonique.

## Compatibilité et sécurité

- aucune route legacy n'est renommée ou supprimée ;
- les IDs legacy Event et Championship ne sont pas réinterprétés ;
- aucune clé `provider_id`, `provider_key`, `external_id`, provenance ou
  payload source n'entre dans le contrat public ;
- les ressources Preview restent derrière les scopes, entitlements et quotas
  existants ;
- F5-7A ne modifie ni les types SQL de publication, ni `/changes`, ni le
  schéma PostgreSQL.

## Frontières

F5-7B, F5-7C et F5-7D restent non autorisés. Ce document ne prouve aucune
publication de catalogues, aucun appel provider, aucun déploiement et aucune
aptitude Production.
