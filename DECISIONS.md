# Index des décisions

Ce fichier résume les choix structurants. Les détails normatifs restent dans
`docs/decisions/`.

## ADR 0001 — Dépôts séparés

Le serveur, le plugin MyBB et l'application Android évoluent dans des dépôts
indépendants. L'API REST est leur contrat commun.

Voir `docs/decisions/0001-separate-repositories.md`.

## ADR 0002 — Serveur source centrale

Le serveur collecte et normalise toutes les données. Les préférences
d'affichage, de calendrier et de notification appartiennent aux clients.

Voir `docs/decisions/0002-server-is-source-of-data.md`.

## ADR 0003 — Séparation progressive des couches

Le code est séparé entre domaine, application, infrastructure et API, avec des
façades de compatibilité aux anciens emplacements.

Voir `docs/decisions/0003-internal-layer-boundaries.md`.

## ADR 0004 — Contrat client versionné

`/api/v1` reste compatible pendant la série 2.x. La synchronisation
différentielle utilise un curseur opaque et détecte les synchronisations
concurrentes par des réponses 409 ou 503.

Voir `docs/decisions/0004-versioned-client-contract.md`.

## ADR 0005 — Qualité temporelle et configuration administrable

Les incohérences `end_at < start_at` sont signalées et corrigées explicitement
par override. L'administration peut modifier le fichier `.env`, sauf les
paramètres PostgreSQL protégés, puis demande un redémarrage contrôlé.

Voir `docs/decisions/0005-admin-data-quality-and-config.md`.

## Règle de décision

Tout changement d'architecture, de schéma SQL, de contrat public, de sécurité
ou de politique de données doit être consigné dans un nouvel ADR avant
implémentation.
