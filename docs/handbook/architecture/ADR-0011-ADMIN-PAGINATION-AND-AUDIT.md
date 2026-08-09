# ADR-0011 — Pagination et audit de l'administration

## Décision

Les listes administratives Événements, Corrections et Journal acceptent une
pagination serveur bornée à 100 lignes. Les filtres et tris sont validés par
Zod, appliqués en SQL avant `LIMIT/OFFSET`, et les colonnes de tri proviennent
d'une liste blanche.

Sans paramètre `page`, les routes Événements et Corrections conservent leur
réponse tableau historique. Avec `page`, elles retournent `items` et les
métadonnées `page`, `page_size`, `total` et `pages`.

Toute mutation administrative est journalisée avec l'acteur authentifié,
l'action, la ressource, l'identifiant de requête et les valeurs avant/après.
Les champs sensibles sont supprimés récursivement. L'identité
`(provider_key, external_id)` d'un événement fournisseur est unique.

## Migration

La migration `0003_admin_audit_and_provider_identity` crée le journal, ses
index et l'index unique fournisseur. Son rollback retire uniquement ces objets.
