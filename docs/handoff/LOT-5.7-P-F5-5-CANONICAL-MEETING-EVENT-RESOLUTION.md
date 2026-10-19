# F5-5 — Canonical Meeting/Event resolution

Statut : `MAINTAINER_VALIDATED`.

## Certification mainteneur

- commit fonctionnel final : `0e8247e0891d7572b933ffa0e3cd2258bd250c16` ;
- tree fonctionnel final : `0beb035181e77816b90cc543ffd6bfec61eeed80` ;
- schema head : `0036_f5_meeting_event_canonical_resolution` ;
- second ré-audit mainteneur indépendant : `PASS` ;
- Validate legacy Python server #274 : `SUCCESS` ;
- CI — Node target #543 : `SUCCESS` ;
- bloqueurs P1 : `NONE` ;
- bloqueurs P2 : `NONE` ;
- violations de périmètre : `NONE`.

L'audit d'architecture préalable a fixé la propriété Season du Meeting, la
relation parent Event → Meeting et la séparation entre résolution d'identité
et réconciliation. Le premier candidat d'implémentation
`1884ed47da081acfa6775fb8c7f60ce4dd60431d` et son premier audit mainteneur
`FAIL` ont ensuite mis en évidence trois bloqueurs P1 : une mutation du
Championship du Meeting pouvait
contourner la cohérence parent/enfant, une décision pouvait devenir terminale
sans matérialisation réussie, et une seconde source pouvait provoquer un
last-writer-wins implicite. L'amendement correctif a fermé ces trois chemins :

1. `Meeting Championship mutation bypass` : contraintes différées couvrant
   Meeting, Event et relation, avec transition atomique cohérente autorisée ;
2. `terminal decision without materialization` : décision et matérialisation
   atomiques, rollback vers un état retentable ou `REVIEW_REQUIRED` ;
3. `implicit multi-provider last-writer-wins` : `link existing` ne crée que
   le lien d'identité et ne modifie aucun champ canonique.

Les amendements correctifs, culminant dans le commit fonctionnel final
`0e8247e0891d7572b933ffa0e3cd2258bd250c16`, ont fermé ces chemins. Le second
audit indépendant `PASS` a reproduit les anciens scénarios et confirmé qu'ils
sont désormais refusés, tandis que les transitions valides restent acceptées.
Le commit fonctionnel final et ses deux workflows CI ont ensuite été validés
par le mainteneur.

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
distinctes. F5-5 n'implémente que la première ; toute contribution, priorité ou
réconciliation multi-provider reste explicitement différée à F5-6, qui demeure
`NOT_STARTED_NOT_AUTHORIZED`.

## Validation locale attendue

Le harnais `scripts/test-f5-meeting-event-resolution.sh` utilise uniquement un
PostgreSQL Docker jetable. Il vérifie la chaîne 0035 -> 0036, le DOWN vide, le
re-upgrade, les contraintes parent/Championship/Venue/Layout et le refus du
DOWN peuplé. Les tests TypeScript couvrent le matching, la publication et le
contrat admin strict. Les tests Python empêchent les régressions de périmètre.

Cette validation ne clôt pas F5 global. F5-6 et F5-7 restent
`NOT_STARTED_NOT_AUTHORIZED`, F5 reste `IN_PROGRESS` et Production reste
`NOT_AUTHORIZED`.
