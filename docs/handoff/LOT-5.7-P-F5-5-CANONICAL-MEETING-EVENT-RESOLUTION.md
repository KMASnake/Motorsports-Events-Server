# F5-5 — Canonical Meeting/Event resolution

Statut : `IMPLEMENTED_AWAITING_MAINTAINER_VALIDATION`.

## Périmètre implémenté

- migration `0036_f5_meeting_event_canonical_resolution` additive ;
- Season détenue uniquement par Meeting ;
- parent Meeting obligatoire et Championship cohérent pour tout Event canonique ;
- références Venue/Layout scoped sur Meeting et Event ;
- type de session data-driven et fallback `other` sans perte du label source ;
- lien source durable prioritaire, matching scoped par ChampionshipSeason UUID ;
- reprise révisionnée après résolution d'un parent ;
- décisions append-only, idempotentes et fail-closed ;
- corrections de source conservant l'identité durable sans recréer son UUID ;
- `link existing` limité au lien d'identité : aucune metadata canonique ou
  publication existante n'est écrasée par la nouvelle source ;
- publication identique sans nouvelle révision ni nouvelle séquence.

## Limites préservées

Il n'existe aucun `events.championship_season_id`. Aucun merge, arbitrage
multi-provider champ par champ, modèle Results, appel provider, activation,
worker, scheduler, déploiement ou changement d'API publique n'appartient à ce
sous-lot.

La résolution d'identité et la réconciliation des champs sont deux opérations
distinctes. F5-5 n'implémente que la première ; toute contribution ou priorité
multi-provider reste explicitement différée à F5-6.

## Validation locale attendue

Le harnais `scripts/test-f5-meeting-event-resolution.sh` utilise uniquement un
PostgreSQL Docker jetable. Il vérifie la chaîne 0035 -> 0036, le DOWN vide, le
re-upgrade, les contraintes parent/Championship/Venue/Layout et le refus du
DOWN peuplé. Les tests TypeScript couvrent le matching, la publication et le
contrat admin strict. Les tests Python empêchent les régressions de périmètre.

Une réussite locale ou CI ne constitue pas une validation mainteneur et
n'autorise ni F5-6, ni F5-7, ni Production.
