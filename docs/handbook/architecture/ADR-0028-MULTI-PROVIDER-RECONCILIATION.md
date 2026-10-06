# ADR-0028 — Réconciliation multi-provider déterministe

Statut : candidat F5-6, en attente d’audit mainteneur.

## Décision

La réconciliation ne décide jamais de l’identité d’un Meeting ou Event. Les
UUID établis par F5-5 et le parent d’un Event sont immuables. Les liens source
ne portent que l’identité et ne mutent aucun champ canonique.

Le pipeline est strictement : observation fournisseur, correction source,
contribution normalisée immuable, policy versionnée, override canonique, état
effectif matérialisé dans `meetings`/`events`, puis publication. L’ordre
d’arrivée, `received_at`, une séquence SQL ou l’heure courante ne départagent
jamais implicitement deux fournisseurs.

Les policies sont scoped par championnat, type de ressource et champ, avec une
Season canonique optionnelle. Une version activée est immuable. Toute règle
dépendant du temps reçoit et persiste `evaluation_at`. Les priorités, tolérances
de calendrier, règles de statut et seuils de fraîcheur sont versionnés.

Les conflits critiques empêchent toute matérialisation partielle. Un override
administratif actif prévaut sur la policy sans modifier les contributions ni
effacer le conflit historique. Les mutations utilisent révision attendue et
idempotence.

## Compatibilité

`provider_source_corrections` reste exclusivement en amont de la normalisation.
`event_corrections` est importée, conservée physiquement puis rendue read-only.
`canonical_field_overrides` devient l’unique autorité; les routes historiques
sont une façade et ne font aucun dual-write.

Le DOWN 0037 refuse toute suppression lorsqu’une preuve F5-6 existe. Merge
d’identités, API publique, Results et activation opérationnelle des providers
restent hors F5-6.
