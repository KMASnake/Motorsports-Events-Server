# Changelog

## 2.5.2 — Cohérence pendant les synchronisations

- Ajout de l'identifiant de synchronisation dans le curseur opaque.
- Réponse `503` lorsque le scheduler modifie les données.
- Réponse `409` lorsqu'une synchronisation invalide une pagination.
- Prévention des pages vides silencieuses pendant une synchronisation.
- Documentation de la stratégie de reprise MyBB et Android.

## 2.5.1 — Correctif de pagination du jalon 3

- Comparaison des curseurs par microsecondes Unix plutôt que par dates SQL.
- Compatibilité avec les bases historiques utilisant un timestamp sans fuseau.
- Correction d'une page vide après une réponse `has_more=true`.
- Suppression du `DISTINCT` incompatible avec le champ PostgreSQL `json`.
- Sélection des épreuves par une sous-requête groupée sur les séances.
- Ajout d'un test de non-régression sur la normalisation des fuseaux.

## 2.5.0 — Jalon 3, contrats clients

- Déclaration explicite des schémas publics OpenAPI v1.
- Stabilisation des champs JSON des sports, épreuves et séances.
- Pagination différentielle déterministe par horodatage et identifiant.
- Ajout d'un curseur opaque conservant un instantané cohérent.
- Conservation du paramètre historique `since` et de `next_cursor`.
- Ajout de `limit`, `has_more`, `cursor` et `snapshot_at`.
- Documentation du contrat API et des intégrations MyBB et Android.
- Formalisation de la politique de compatibilité de `/api/v1`.
- Ajout de tests de non-régression des réponses et des curseurs.

## Jalon 2 — Séparation interne progressive

- Extraction du domaine métier sans dépendance aux frameworks.
- Isolation de la persistance SQLAlchemy.
- Déplacement du cas d’usage de synchronisation dans la couche application.
- Extraction des règles de filtrage de l’API.
- Maintien des anciens imports par des façades de compatibilité.
- Ajout de tests de non-régression métier et API.

## 2.4.0

- Ajout de `upgrade.sh <archive.zip>`.
- Sauvegarde automatique du `.env`.
- Sauvegarde PostgreSQL avant mise à niveau.
- Extraction dans un répertoire temporaire.
- Reconstruction Docker systématique sans cache.
- Suppression des anciennes images du projet.
- Contrôle de santé après déploiement.
- Vérification de la version réellement exécutée.
- Rollback automatique en cas d’échec.
- Endpoint `GET /api/v1/version`.
- Affichage version, build et commit dans l’administration.
- Ajout de `verify-installation.sh`.

## 2.3.0

- Page Paramètres dans l’administration.
- Affichage, masquage et copie des clés API.
- Export JSON de configuration client.
- QR Code de connexion.
- État CPU, mémoire, disque et taille PostgreSQL.
- Tests OCBlackTop et TheSportsDB.
- Commande `show-keys.sh`.
- Clé administrateur exclue de l’export client.

## 2.2.0

- Le serveur importe désormais toutes les séances sans filtre `race/all`.
- Les filtres sont appliqués uniquement par les clients via l’API.
- Ajout des champs `category` et `is_race` sur les séances.
- Les sprints sont considérés comme des courses.
- `Superpole Race`, `Feature Race`, `Main Race` et `Heat Race` sont des courses.
- `Sprint Qualifying` reste une qualification.
- Ajout des filtres API : saison, sports, types, catégories, statuts,
  `is_race`, séances annulées et séances supprimées.
- Migration automatique des bases 2.1.x.
- Correction du provider OCBlackTop selon le plugin MyBB 1.4.0.
- Pagination OCBlackTop et traitement WRC séparé.
- Conservation des séances disparues avec l’indicateur `deleted`.

## 2.1.0

- Nouvelle administration Web protégée par la clé administrateur.
- Tableau de bord avec compteurs sports, épreuves, séances et corrections.
- Affichage de l’état et de la configuration des providers.
- Synchronisation manuelle depuis le navigateur.
- Historique des synchronisations et détails des erreurs.
- Suppression des corrections depuis l’interface.
- Écriture sûre du `.env`, y compris les valeurs contenant des espaces.
- Attribution automatique du `.env` à l’utilisateur ayant lancé `sudo`.
- Suppression des chargements fragiles par `source .env`.
- Ajout d’un lecteur `.env` robuste pour les scripts.

## 2.0.3

- Correctif PostgreSQL validé sur VPS.
- `data` appartient à root:root avec le mode 755.
- `data/postgres` appartient à l’utilisateur PostgreSQL de l’image.
- Répertoires PostgreSQL en 700 et fichiers en 600.
- Vérification finale des permissions avant démarrage.
- Script autonome de réparation mis à jour.

## 2.0.2

- Correction automatique des permissions de `data/postgres`.
- Détection dynamique de l’UID/GID PostgreSQL.
- Valeur de secours `70:70` pour `postgres:16-alpine`.
- Ajout de `fix-postgres-permissions.sh`.

## 2.0.1

- Vérification automatique des ports 80 et 443 avant le démarrage de Caddy.
- Détection du processus ou du conteneur qui occupe le port.
- Proposition d’arrêt d’un ancien conteneur Docker.
- Proposition d’arrêt de nginx ou Apache lorsqu’ils occupent le port.
- Annulation propre de l’installation si le conflit persiste.

## 2.0.0

- Refonte complète de l’arborescence.
- Suppression des dossiers visibles `platforms/vps` et `platforms/synology`.
- Unification de Docker Compose.
- Unification du Caddyfile.
- Ajout des commandes racine start/stop/restart/logs/status/backup/update.
- Détection automatique de l’environnement conservée.
- Tous les chemins d’exploitation sont relatifs à la racine du projet.
- Données et sauvegardes centralisées.
