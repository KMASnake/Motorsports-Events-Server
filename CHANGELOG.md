# Changelog

## 2.7.0-rc.1 — Candidate de stabilisation

- Gel fonctionnel du jalon 4 avant publication de la version stable.
- Contrat `/api/v1`, schéma PostgreSQL et comportement des providers
  inchangés depuis l’alpha.15 validée.
- Ajout d’une checklist commune de qualification et de promotion.
- Validation locale, PostgreSQL, archive GitHub et VPS exigées avant
  intégration.

## 2.7.0-alpha.15 — Provisioning Grafana complet

- Ajout des répertoires de provisioning Grafana facultatifs `alerting/` et
  `plugins/`.
- Conservation des répertoires vides dans les archives de release.
- Test de non-régression couvrant les quatre catégories de provisioning.
- Exposition privée de Grafana et Prometheus inchangée.

## 2.7.0-alpha.14 — Artefacts de release GitHub

- Construction automatique de l’archive après les tests applicatifs et
  PostgreSQL.
- Vérification du SHA-256 avant publication.
- Archive ZIP et empreinte publiées ensemble comme artefact GitHub Actions.
- Fichier SHA-256 portable, sans chemin absolu propre au runner.
- Échec explicite du job si un fichier de livraison manque.
- Conservation des artefacts pendant quatorze jours.

## 2.7.0-alpha.13 — Mise à niveau et rollback testables

- Bascule des fichiers de release isolée dans une bibliothèque Bash testable.
- Simulation déterministe d’une candidate en échec avec données persistantes.
- Refus du rollback lorsqu’un état ambigu contient deux répertoires de données.
- Conservation de l’état optionnel de Prometheus et Grafana pendant une mise à
  niveau ou un rollback.
- Suppression des avertissements de réseau occupé et de conteneurs de
  supervision orphelins.
- Cohérence du build racine, du build serveur et des valeurs Compose contrôlée.

## 2.7.0-alpha.12 — Alertes de supervision

- Règles Prometheus pour l’indisponibilité de l’API, les erreurs HTTP 5xx et
  les redémarrages répétés.
- Délai de confirmation pour éviter les alertes transitoires.
- Compteur des alertes actives ajouté au tableau Grafana.
- État de collecte Prometheus utilisé pour afficher la disponibilité réelle.
- Couleur de l’uptime corrigée pour ne plus signaler un démarrage récent comme
  une panne.
- Cohérence de la version et du build Compose vérifiée automatiquement avant
  livraison.
- Données persistantes replacées dans la version précédente avant la
  suppression d’une candidate en échec.

## 2.7.0-alpha.11 — Supervision privée

- Prometheus collecte `/metrics` toutes les 30 secondes et conserve 30 jours.
- Grafana écoute uniquement sur `127.0.0.1:3000`.
- Mot de passe administrateur obligatoire et inscriptions désactivées.
- Source Prometheus et tableau de bord API provisionnés automatiquement.
- Scripts de démarrage et d’état dédiés.

## 2.7.0-alpha.10 — Endpoints d’observabilité

- `/live` contrôle la disponibilité du processus API.
- `/ready` contrôle la connexion PostgreSQL.
- `/metrics` expose des métriques Prometheus sans donnée sensible.
- Compteurs HTTP bornés par méthode, route déclarée et statut.

## 2.7.0-alpha.9 — Prérequis de mise à niveau

- Validation de l’archive avant toute écriture.
- Contrôle de Docker, Compose, des outils, du `.env` et de l’espace disque.
- Vérification d’une racine unique et des fichiers obligatoires du ZIP.
- Refus précoce sans arrêt des services ni création de sauvegarde.

## 2.7.0-alpha.8 — Sauvegardes automatisées

- Création atomique des sauvegardes PostgreSQL compressées.
- Vérification gzip puis restauration dans une base temporaire.
- Restauration de production refusée avant validation complète de l’archive.
- Redémarrage garanti de l’API et du scheduler après une erreur de restauration.
- Rétention configurable, 30 jours par défaut.
- Timer systemd quotidien, persistant et légèrement randomisé.

## 2.7.0-alpha.7 — Rotation des logs Docker

- Rotation `json-file` appliquée aux cinq services de production.
- Taille bornée à 10 Mio par fichier et cinq fichiers par conteneur.
- Compression automatique des fichiers tournés.
- Configuration Compose commune sans modification globale du démon Docker.
- Contrat API et schéma PostgreSQL inchangés.

## 2.7.0-alpha.6 — Logs structurés JSON

- Format JSON commun pour l’API, le scheduler et les bibliothèques.
- Journal HTTP avec identifiant de requête, statut et durée.
- Événements structurés de début, fin et erreur de synchronisation.
- Désactivation du journal d’accès texte d’Uvicorn.
- Masquage récursif des champs sensibles.
- Masquage des clés connues lorsqu’elles apparaissent dans un message.
- Utilisation de noms de compteurs compatibles avec les attributs `LogRecord`.
- Conversion des erreurs HTTP non gérées en réponse JSON corrélée.
- Verrou PostgreSQL empêchant les synchronisations API et scheduler simultanées.
- Clôture automatique des synchronisations orphelines comme interrompues.
- Échec immédiat, sans attente de cinq minutes, lorsque le quota mensuel
  OCBlackTop est épuisé.

## 2.7.0-alpha.5 — Journal d’administration

- Ajout de la migration `0002_admin_audit_log`.
- Journal persistant consultable dans `/admin/audit`.
- API protégée `GET /api/v1/admin/audit`.
- Traçage des connexions, synchronisations, overrides, corrections horaires,
  changements de configuration et tests providers.
- Conservation exclusive de métadonnées non sensibles.
- Migration d’une base existante de `0001` vers `0002` testée.

## 2.7.0-alpha.4 — Administration modulaire

- Extraction des routes d’administration hors du point d’entrée public.
- Ajout d’un routeur d’administration agrégateur.
- Conservation de toutes les URLs, méthodes, redirections et réponses.
- Ajout de tests empêchant le retour des routes admin dans `app.main`.
- Aucun changement visuel ni modification du contrat API public.

## 2.7.0-alpha.3 — Intégration PostgreSQL

- Ajout d’un environnement Docker PostgreSQL 16 réservé aux tests.
- Migration testée sur une base vierge et une base existante.
- Jeu de données IndyCar reproductible et versionné.
- Persistance des sports, événements, séances et données JSON vérifiée.
- Synchronisation répétée et conservation d’un override vérifiées.
- Nettoyage automatique des conteneurs et données temporaires.
- Exécution dédiée ajoutée à GitHub Actions.
- Vérification du schéma exécutée depuis l’API déjà connectée à PostgreSQL.

## 2.7.0-alpha.2 — Qualité des providers

- Ajout de tests HTTP déterministes avec `httpx.MockTransport`.
- Couverture de la pagination et de la normalisation OCBlackTop.
- Couverture des réponses WRC, erreurs HTTP/JSON et limitations 429.
- Couverture de la normalisation et des statuts TheSportsDB.
- Mesure de la couverture des providers dans GitHub Actions.
- Seuil minimal de couverture fixé à 85 %.

## 2.7.0-alpha.1 — Infrastructure Alembic

- Ajout d’une migration initiale décrivant l’intégralité du schéma.
- Migration exécutée par un service Docker dédié avant l’API et le scheduler.
- Adoption contrôlée des bases 2.6.0 existantes sans perte de données.
- Refus des schémas existants incomplets ou inconnus.
- Vérification automatique de la révision au démarrage et à l’installation.
- Suppression des migrations SQL ad hoc au profit d’Alembic.

## 2.6.0 — Administration et qualité des données

- Signalement des séances dont la fin précède le début.
- Page d'administration dédiée aux incohérences horaires.
- Correction immédiate des horaires avec override persistant.
- Édition contrôlée du fichier `.env` depuis l'administration.
- Masquage et conservation des secrets laissés vides.
- Validation des domaines, URLs, ports, saisons, intervalles et fuseaux.
- Protection des paramètres PostgreSQL contre les modifications Web.
- Montage limité au seul fichier `.env` dans le conteneur API.
- Redémarrage explicite requis, sans exposition du socket Docker.

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
