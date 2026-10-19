# ADR — Corrections fournisseur

## ADR-4.2-COR-001 — Séparation source / override

La donnée fournisseur et la correction locale sont stockées séparément.

## ADR-4.2-COR-002 — Valeur effective calculée

L'application affiche l'override local lorsqu'il existe, sinon la valeur
fournisseur.

## ADR-4.2-COR-003 — Synchronisation non destructive

Une synchronisation ne remplace jamais une correction locale active.

## ADR-4.2-COR-004 — Conflit explicite

Tout changement de valeur fournisseur sous un override actif génère un conflit
visible et résolvable dans la page Corrections.

## ADR-4.2-COR-005 — API publique nettoyée

Les clients publics reçoivent la valeur effective sans détail d'override.


## ADR-4.2-COR-006 — Source manuelle souveraine

Un événement créé manuellement est une donnée native du serveur. Ses
modifications sont directes et ne génèrent jamais de correction fournisseur.

## ADR-4.2-COR-007 — Visibilité champ par champ

La page Corrections doit rendre chaque override identifiable individuellement,
avec comparaison source/locale et statut de conflit.

## Implémentation étape 2 — 2026-08-03

- service unique : `apps/api/src/lib/eventCorrections.ts` ;
- transaction et rollback : `withTransaction` dans `apps/api/src/lib/db.ts` ;
- verrouillage uniforme de l'événement avant ses corrections ;
- endpoint d'ingestion fournisseur isolé :
  `POST /api/v1/admin/events/:id/provider-sync` ;
- validateur réel : `npm run validate:step2`.

La route d'ingestion est administrative et n'ajoute aucun champ à l'API
publique.
