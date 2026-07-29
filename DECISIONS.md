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

## ADR 0006 — Migrations de schéma avec Alembic

Alembic devient l’unique mécanisme de migration. Un service Docker dédié
applique les migrations avant le démarrage de l’API et du scheduler. Une base
2.6.0 existante est contrôlée puis adoptée sans recréer ses tables.

Voir `docs/decisions/0006-alembic-schema-migrations.md`.

## ADR 0007 — Tests PostgreSQL isolés

Les tests d’intégration utilisent un projet Docker Compose dédié, PostgreSQL
sur stockage temporaire et des bases créées par test. Aucun test ne se connecte
à la base locale ou VPS.

Voir `docs/decisions/0007-isolated-postgres-tests.md`.

## ADR 0008 — Routes d’administration modulaires

Les routes publiques restent dans `app.main`. L’authentification, le tableau
de bord et les API d’administration sont regroupés derrière le routeur
`app.admin`, sans changement des URLs ni du rendu existant.

Voir `docs/decisions/0008-modular-admin-router.md`.

## ADR 0009 — Journal d’administration

Les actions administratives sont enregistrées avec leur résultat et des
métadonnées non sensibles. Aucun secret, cookie ou contenu `.env` n’est
persisté dans le journal.

Voir `docs/decisions/0009-admin-audit-log.md`.

## ADR 0010 — Logs structurés JSON

L’API et le scheduler écrivent des événements JSON sur la sortie standard.
Les accès HTTP sont corrélés par identifiant de requête et les secrets sont
masqués avant sérialisation.

Voir `docs/decisions/0010-structured-json-logging.md`.

## ADR 0011 — Rotation des journaux Docker

Tous les services utilisent le pilote `json-file` avec une taille et un nombre
de fichiers bornés, ainsi que la compression des fichiers tournés.

Voir `docs/decisions/0011-docker-log-rotation.md`.

## ADR 0012 — Sauvegardes automatisées et vérifiées

Les sauvegardes quotidiennes sont atomiques et ne sont acceptées qu’après une
restauration réussie dans une base PostgreSQL temporaire.

Voir `docs/decisions/0012-verified-automated-backups.md`.

## ADR 0013 — Endpoints d’observabilité

Les sondes de vie, disponibilité et métriques sont publiques, minimales et
sans labels à forte cardinalité.

Voir `docs/decisions/0013-observability-endpoints.md`.

## ADR 0014 — Supervision privée

Prometheus reste interne à Docker et Grafana écoute uniquement sur localhost,
avec accès par tunnel SSH.

Voir `docs/decisions/0014-private-prometheus-grafana.md`.

## ADR 0015 — Alertes locales de supervision

Prometheus évalue localement les alertes techniques. Grafana les affiche sans
canal de notification ni nouvelle exposition réseau.

Voir `docs/decisions/0015-local-monitoring-alerts.md`.

## Règle de décision

Tout changement d'architecture, de schéma SQL, de contrat public, de sécurité
ou de politique de données doit être consigné dans un nouvel ADR avant
implémentation.
