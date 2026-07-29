# État du projet

Dernière mise à jour : 29 juillet 2026.

## Version retenue

- projet : `motorsports-events-server` ;
- version fonctionnelle : `2.6.0` ;
- jalon : `4-admin-data-quality` ;
- build : `20260728-214529` ;
- API publique : `/api/v1` ;
- dépôt GitHub : `KMASnake/Motorsports-Events-Server` (privé).

La version ajoute :

- le signalement des séances dont la fin précède le début ;
- leur correction manuelle avec override persistant ;
- l’édition contrôlée du `.env` depuis l’administration ;
- la protection des paramètres PostgreSQL et des secrets laissés vides ;
- l’application explicite de la nouvelle configuration après redémarrage.

## Sous-jalon Alembic validé

- version : `2.7.0-alpha.1` ;
- sous-jalon : `4.1-alembic-schema` ;
- build : `20260729-101537` ;
- branche : `feature/alembic-schema` ;
- révision de schéma : `0001_initial_schema` ;
- contrat API v1 : inchangé.

La candidate remplace les créations de tables et migrations SQL au démarrage
par un service Alembic dédié. L’API et le scheduler ne démarrent qu’après une
migration réussie et vérifient eux-mêmes la révision attendue.

### Validation locale de la candidate

- validation reproductible : 30 tests, dont 27 réussis et 3 ignorés lorsque
  les dépendances applicatives ne sont pas installées ;
- suite complète avec dépendances : 34 tests réussis ;
- base SQLite vierge migrée : réussie ;
- adoption SQLite d’un schéma 2.6.0 avec conservation des données : réussie ;
- schéma SQLite incomplet refusé : réussi ;
- correspondance entre migration et modèles : réussie ;
- image Docker construite : réussie ;
- PostgreSQL 16 vierge migré : réussi ;
- adoption PostgreSQL 16 avec conservation d’une donnée IndyCar : réussie ;
- archive candidate : `motorsports-events-server-2.7.0-alpha.1.zip` ;
- SHA-256 :
  `fc907f58f58297af030904e5a42e8f4570f604092bdffad8421ddc3ea1f376f8` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS de la candidate

- version locale et API : `2.7.0-alpha.1`, build `20260729-101537` ;
- service de migration : `Exited (0)` ;
- révision du schéma : `0001_initial_schema` ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- données conservées : 18 épreuves et 110 séances IndyCar ;
- corrections conservées : 10 Warmup et aucune incohérence temporelle ;
- synchronisation : 0 créée, 243 mises à jour, 0 erreur ;
- révision inchangée après synchronisation ;
- sauvegarde PostgreSQL : valide ;
- dossier de rollback : présent ;
- journaux API, scheduler et migration : aucune erreur détectée.

## Candidate qualité des providers

- version : `2.7.0-alpha.2` ;
- sous-jalon : `4.2-provider-quality` ;
- build : `20260729-105950` ;
- branche : `feature/provider-tests-coverage` ;
- contrat API v1 et interfaces `fetch(season)` : inchangés.

La candidate ajoute des transports HTTP injectables uniquement pour les tests,
des réponses OCBlackTop et TheSportsDB entièrement simulées, ainsi qu’un seuil
de couverture providers contrôlé par GitHub Actions.

### Validation locale

- 9 tests providers et 5 sous-tests réussis ;
- pagination et normalisation OCBlackTop : réussies ;
- WRC, temporisation 429 et erreurs HTTP/JSON : couverts ;
- dates, statuts et normalisation TheSportsDB : couverts ;
- suite complète : 43 tests et 5 sous-tests réussis ;
- couverture providers : 92,41 % ;
- seuil CI : 85 % ;
- archive : `motorsports-events-server-2.7.0-alpha.2.zip` ;
- SHA-256 :
  `71be8eb347b95f8a4c3bdf4952a5def6a1fee844ba44a15aff2e3cb91b44f9b1` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.2`, build `20260729-105950` ;
- OCBlackTop : connexion réussie, 695 ms ;
- TheSportsDB : connexion réussie, 77 ms ;
- synchronisation : 0 créée, 243 mises à jour, 0 erreur ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- révision du schéma : `0001_initial_schema` ;
- sports et données accessibles ;
- aucune erreur dans les journaux API, scheduler et migration.

## Candidate intégration PostgreSQL

- version : `2.7.0-alpha.3` ;
- sous-jalon : `4.3-postgres-integration` ;
- build : `20260729-111254` ;
- branche : `feature/postgres-integration-tests` ;
- contrat API v1 et schéma de production : inchangés.

La candidate ajoute un environnement PostgreSQL 16 temporaire, trois tests
d’intégration et un jeu IndyCar versionné. Les conteneurs, réseaux, volumes et
bases créés pour les tests sont supprimés automatiquement.

### Validation locale

- migration PostgreSQL vierge vers `0001_initial_schema` : réussie ;
- adoption d’un schéma existant avec conservation des données : réussie ;
- persistance du jeu IndyCar : réussie ;
- synchronisation répétée sans doublon : réussie ;
- override conservé après synchronisation : réussi ;
- nettoyage des ressources Docker : réussi ;
- suite PostgreSQL : 3 tests réussis sans avertissement ;
- suite applicative : 43 tests, 3 tests PostgreSQL ignorés hors Docker et
  5 sous-tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.3.zip` ;
- SHA-256 : voir le fichier compagnon
  `motorsports-events-server-2.7.0-alpha.3.zip.sha256` ;
- validation VPS : réussie le 29 juillet 2026.

La première validation VPS a révélé que `verify-installation.sh` lançait son
contrôle de schéma dans un conteneur temporaire avec `--no-deps`. Ce conteneur
ne résolvait pas l’alias Docker `db`, alors que l’API déployée restait
opérationnelle. Le contrôle utilise désormais le conteneur API déjà sain et
connecté au réseau de production. L’archive alpha.3 corrigée a ensuite été
installée et validée.

### Validation VPS

- version locale et API : `2.7.0-alpha.3`, build `20260729-111254` ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- service de migration : terminé correctement ;
- révision du schéma : `0001_initial_schema` ;
- sports accessibles ;
- synchronisation : 0 créée, 243 mises à jour, 0 erreur ;
- journaux API, scheduler et migration : aucune erreur détectée ;
- correctif de vérification du schéma : validé depuis le conteneur API.

## Candidate administration modulaire

- version : `2.7.0-alpha.4` ;
- sous-jalon : `4.4-admin-modularization` ;
- build : `20260729-115446` ;
- branche : `feature/admin-modularization` ;
- contrat API v1, URLs d’administration et schéma SQL : inchangés.

La candidate retire de `app.main` l’authentification, le tableau de bord, les
overrides et le déclenchement administratif des synchronisations. Le paquet
`app.admin` agrège ces routes avec la façade d’administration existante. Aucun
changement visuel n’est inclus.

### Validation locale

- syntaxe Python : réussie ;
- suite applicative : 45 tests, 3 tests PostgreSQL ignorés hors Docker et
  5 sous-tests réussis ;
- suite PostgreSQL isolée : 3 tests réussis ;
- contrôle statique des routes d’administration : ajouté ;
- archive : `motorsports-events-server-2.7.0-alpha.4.zip` ;
- SHA-256 :
  `f38957e20b1d7ab759caa3600b656df760b272b93d022174dce5b8ea6c476d58` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- tableau de bord `/admin` : accessible ;
- paramètres `/admin/settings` : accessibles ;
- incohérences horaires `/admin/temporal-issues` : accessibles ;
- OCBlackTop : connexion réussie, 529 ms ;
- TheSportsDB : connexion réussie, 199 ms ;
- synchronisation : 0 créée, 243 mises à jour, 0 erreur ;
- journaux API, scheduler et migration : aucune erreur détectée.

## Candidate journal d’administration

- version : `2.7.0-alpha.5` ;
- sous-jalon : `4.5-admin-audit-log` ;
- build : `20260729-125029` ;
- branche : `feature/admin-audit-log` ;
- révision de schéma : `0002_admin_audit_log` ;
- contrat API public : inchangé.

La candidate ajoute un journal persistant pour les connexions,
synchronisations, overrides, corrections temporelles, modifications de
configuration et tests providers. Les détails ne contiennent que des
métadonnées non sensibles.

### Validation locale

- suite applicative : 47 tests, 3 tests PostgreSQL ignorés hors Docker et
  5 sous-tests réussis ;
- migration SQLite vierge et depuis un schéma existant : réussie ;
- migration PostgreSQL vierge et depuis un schéma existant : réussie ;
- suite PostgreSQL : 3 tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.5.zip` ;
- SHA-256 :
  `162c4badd86dd100ae16808f7c0308a74dc7d29cc56fa0fd0181907cd27dcde3` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.5`, build `20260729-125029` ;
- révision du schéma : `0002_admin_audit_log` ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- connexion réussie et connexion refusée enregistrées ;
- OCBlackTop : connexion réussie, 419 ms ;
- TheSportsDB : connexion réussie, 75 ms ;
- synchronisation : 0 créée, 243 mises à jour, 0 erreur ;
- journal : 4 entrées, actions `auth.login`, `providers.test`, `sync.run` ;
- aucune clé API détectée dans 100 entrées contrôlées ;
- page `/admin/audit` accessible ;
- journaux API, scheduler et migration : aucune erreur détectée.

## Candidate logs structurés JSON

- version : `2.7.0-alpha.6` ;
- sous-jalon : `4.6-structured-json-logs` ;
- build : `20260729-142027` ;
- branche : `feature/structured-json-logs` ;
- révision de schéma : `0002_admin_audit_log` inchangée ;
- contrats API public et administration : inchangés.

La candidate structure les logs API, scheduler, HTTP et synchronisation en
JSON. Les requêtes possèdent un identifiant de corrélation. Les champs
sensibles et valeurs secrètes configurées sont masqués.

La première validation VPS a révélé que le champ contextuel `created` entrait
en conflit avec l’attribut réservé `LogRecord.created`. Les compteurs utilisent
désormais les suffixes `_count`, et les exceptions HTTP non gérées sont
journalisées puis converties en réponse JSON corrélée.

La seconde validation a confirmé que l’API restait saine, mais a révélé deux
synchronisations concurrentes et une attente de 300 secondes sur la réponse
OCBlackTop `429 Monthly limit exceeded`. La candidate corrigée utilise un
verrou consultatif PostgreSQL commun à l’API et au scheduler, clôt les anciennes
exécutions `running` comme `interrupted` et échoue immédiatement lorsque le
quota mensuel est épuisé. Le journal d’accès Uvicorn redondant est aussi
désactivé explicitement.

### Validation locale

- suite applicative : 53 tests, 4 tests PostgreSQL ignorés hors Docker et
  5 sous-tests réussis ;
- suite PostgreSQL isolée : 4 tests réussis, dont verrou concurrent et
  récupération d’une exécution orpheline ;
- format JSON, contexte et redaction : testés ;
- archive : `motorsports-events-server-2.7.0-alpha.6.zip` ;
- SHA-256 de la candidate corrigée : voir le fichier `.zip.sha256` livré
  avec l’archive (l’empreinte précédente est obsolète) ;
- archive réextraite et retestée : réussie ;
- validation VPS fonctionnelle : réussie le 29 juillet 2026 ;
- synchronisation avec quota mensuel OCBlackTop épuisé : fin en 1,235 seconde,
  état `completed_with_errors`, 30 mises à jour et 1 erreur explicite ;
- récupération : les exécutions orphelines 522, 526 et 527 ont été clôturées
  avec l’état `interrupted` ;
- aucune exécution récente ne reste en état `running` ;
- validation finale des logs : 48 lignes JSON valides ;
- événements observés : `http.request`, `logging.configured`, `sync.started`,
  `sync.completed` et `sync.provider_failed` ;
- aucun journal d’accès `uvicorn.access` redondant ;
- candidate `2.7.0-alpha.6` entièrement validée sur le VPS le 29 juillet 2026.

## Candidate rotation des logs Docker

- version : `2.7.0-alpha.7` ;
- sous-jalon : `4.7-docker-log-rotation` ;
- build : `20260729-145707` ;
- branche : `feature/docker-log-rotation` ;
- révision de schéma : `0002_admin_audit_log` inchangée ;
- contrats API public et administration : inchangés.

La candidate applique aux cinq services une politique Docker `json-file`
commune : fichiers de 10 Mio maximum, cinq fichiers conservés et compression
des fichiers tournés. Les conteneurs sont recréés pendant la mise à niveau,
ce qui applique la politique sans modifier la configuration globale du démon.

### Validation locale

- configuration Compose résolue avec succès ;
- présence de la politique sur les cinq services testée ;
- suite applicative : 54 tests et 5 sous-tests réussis ;
- suite PostgreSQL isolée : 4 tests réussis ;
- syntaxe Python et shell : réussie ;
- archive : `motorsports-events-server-2.7.0-alpha.7.zip` ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.7`, build `20260729-145707` ;
- révision du schéma : `0002_admin_audit_log` ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- sports et données accessibles ;
- services `db`, `api`, `scheduler`, `migrate` et `caddy` : pilote
  `json-file`, `max-size=10m`, `max-file=5`, `compress=true`.

## Candidate sauvegardes automatisées

- version : `2.7.0-alpha.8` ;
- sous-jalon : `4.8-automated-backups` ;
- build : `20260729-151518` ;
- branche : `feature/automated-backups` ;
- révision de schéma : `0002_admin_audit_log` inchangée ;
- contrats API public et administration : inchangés.

La candidate crée chaque sauvegarde dans un fichier temporaire, contrôle sa
compression puis la restaure dans une base PostgreSQL jetable avant de la
publier. Les restaurations de production exécutent le même contrôle préalable
et garantissent le redémarrage de l’API et du scheduler. Un timer systemd
persistant planifie l’opération quotidiennement à 03:15 avec un délai aléatoire
maximal de 15 minutes.

### Validation locale

- tests déterministes sauvegarde, restauration et timer : 4 réussis ;
- syntaxe shell : réussie ;
- suite applicative : 57 tests et 5 sous-tests réussis ;
- suite PostgreSQL isolée : 4 tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.8.zip` ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.8`, build `20260729-151518` ;
- révision du schéma : `0002_admin_audit_log` ;
- API et PostgreSQL : sains ;
- Caddy et scheduler : actifs ;
- timer systemd : chargé, activé et en attente ;
- prochaine exécution observée : 30 juillet 2026 à 03:22:59 UTC ;
- sauvegarde réelle : créée et restaurée dans une base temporaire ;
- archive gzip : valide ;
- taille observée : 147 468 octets ;
- permissions et propriétaire : `0600`, `root:root`.

## Candidate contrôle préalable aux mises à niveau

- version : `2.7.0-alpha.9` ;
- sous-jalon : `4.9-upgrade-preflight` ;
- build : `20260729-152713` ;
- branche : `feature/upgrade-preflight` ;
- révision de schéma : `0002_admin_audit_log` inchangée ;
- contrats API public et administration : inchangés.

Le contrôle valide l’archive, sa structure, les outils, Docker Compose, le
fichier `.env` et l’espace disque avant toute écriture ou interruption.

### Validation VPS

- préflight manuel : réussi ;
- version locale et API : `2.7.0-alpha.9`, build `20260729-152713` ;
- API et PostgreSQL : sains ;
- schéma : `0002_admin_audit_log` ;
- Caddy et scheduler : actifs ;
- timer de sauvegarde : conservé, actif et planifié ;
- amorçage : l’upgrade alpha.8 vers alpha.9 utilise encore l’ancien script ;
  le préflight automatique protège les mises à niveau lancées depuis alpha.9.

## Candidate endpoints d’observabilité

- version : `2.7.0-alpha.10` ;
- sous-jalon : `4.10-observability-endpoints` ;
- build : `20260729-154303` ;
- branche : `feature/observability-endpoints` ;
- schéma et contrat API v1 : inchangés.

La candidate ajoute `/live`, `/ready` et `/metrics`. Les métriques n’exposent
aucun secret ni identifiant métier et bornent les labels aux routes déclarées.

### Validation locale

- suite applicative : 60 tests et 5 sous-tests réussis ;
- suite PostgreSQL : 4 tests réussis ;
- archive réextraite et retestée ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.10`, build `20260729-154303` ;
- API et PostgreSQL : sains ;
- schéma : `0002_admin_audit_log` ;
- timer de sauvegarde : conservé et actif ;
- `/live` : HTTP 200, `{"status":"ok"}` ;
- `/ready` : HTTP 200, `{"status":"ready"}` ;
- `/metrics` : exposition Prometheus valide avec compteurs HTTP bornés ;
- type : `text/plain; version=0.0.4; charset=utf-8`.

## Candidate supervision privée

- version : `2.7.0-alpha.11` ;
- sous-jalon : `4.11-private-monitoring` ;
- build : `20260729-160213` ;
- branche : `feature/prometheus-grafana` ;
- schéma et contrat API v1 : inchangés.

Prometheus reste interne à Docker. Grafana écoute sur `127.0.0.1:3000`,
nécessite un mot de passe et fournit un tableau de bord API préconfiguré.

### Validation locale

- configuration Compose combinée : valide ;
- suite applicative : 61 tests et 5 sous-tests réussis ;
- suite PostgreSQL : 4 tests réussis ;
- archive réextraite et retestée ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.11` ;
- API, scheduler, PostgreSQL et Caddy : actifs ;
- Prometheus collecte `/metrics` toutes les 30 secondes ;
- Grafana écoute uniquement sur `127.0.0.1:3000` ;
- Prometheus ne publie aucun port hôte ;
- source Prometheus et tableau API provisionnés ;
- disponibilité API : `1` ;
- taux d’erreurs HTTP observé : `0` ;
- mot de passe Grafana initial exposé hors dépôt puis remplacé.

## Candidate alertes de supervision

- version : `2.7.0-alpha.12` ;
- sous-jalon : `4.12-monitoring-alerts` ;
- branche : `feature/monitoring-alerts` ;
- schéma et contrat API v1 : inchangés.

La candidate ajoute des règles locales pour l’indisponibilité, les erreurs
HTTP 5xx et les redémarrages répétés. Grafana affiche les alertes actives sans
ajouter de canal de notification ou de port public.

### Validation locale

- configuration Prometheus : valide avec 3 règles chargées par `promtool` ;
- configuration Compose combinée : valide ;
- suite applicative légère : 51 tests, dont 33 réussis et 18 ignorés lorsque
  les dépendances applicatives ne sont pas installées ;
- suite PostgreSQL isolée : 4 tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.12.zip` ;
- archive réextraite et retestée : réussie ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- première installation VPS : rollback automatique réussi, car les valeurs
  Compose alpha.11 écrasaient la version alpha.12 embarquée ;
- correctif : versions et builds Compose alignés et protégés par un test de
  non-régression ;
- anomalie détectée après rollback : le déplacement de `data/` vers la
  candidate pouvait supprimer les données PostgreSQL lors de sa suppression ;
- correctif : `data/` est désormais replacé dans le rollback avant toute
  suppression de la candidate ;
- restauration VPS depuis la sauvegarde pré-upgrade : réussie ;
- correctif de rollback extrait de l’archive corrigée et installé sur le VPS ;
- validation VPS de l’archive corrigée : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.12`, build `20260729-163135` ;
- schéma : `0002_admin_audit_log` ;
- API, PostgreSQL, scheduler, Caddy, Prometheus et Grafana : actifs ;
- règles Prometheus : configuration valide, 3 règles chargées ;
- incident réel détecté : `MotorsportsApiRepeatedRestarts` actif après les
  mises à niveau et le rollback, avec extinction automatique attendue après
  la fenêtre de 30 minutes ;
- première candidate refusée automatiquement car les valeurs Compose alpha.11
  écrasaient sa version applicative alpha.12 ;
- ce rollback a révélé que `data/`, déplacé dans la candidate, pouvait être
  supprimé avec elle ;
- base restaurée depuis
  `pre-upgrade-20260729-142828.sql.gz` : 13 sports, 243 événements,
  1 186 séances et 3 overrides ;
- sauvegarde post-incident de 6 254 octets explicitement écartée ;
- `upgrade.sh` corrigé installé depuis l’archive dont le SHA-256 est
  `f2ce2018116f9d8e9f507e94880d69d57c10acf02e3462fedd376358732bdc2f` ;
- syntaxe du script corrigé : valide.

## Candidate rollback reproductible

- version : `2.7.0-alpha.13` ;
- sous-jalon : `4.13-upgrade-rollback-tests` ;
- branche : `feature/upgrade-rollback-tests` ;
- schéma et contrat API v1 : inchangés.

La candidate isole la bascule des fichiers, vérifie réellement la conservation
de `data/` pendant un échec et gère la supervision optionnelle sans conteneurs
orphelins.

### Validation locale

- scénario de bascule puis rollback avec donnée sentinelle : réussi ;
- état ambigu avec deux répertoires de données : refusé ;
- conservation de l’état optionnel de la supervision : testée ;
- suite ciblée upgrade, métadonnées et monitoring : 7 tests réussis ;
- suite applicative complète : 65 tests, 4 ignorés et 5 sous-tests réussis ;
- suite PostgreSQL isolée : 4 tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.13.zip` ;
- archive réextraite et retestée : réussie ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- validation VPS : en attente.

## Validation de la 2.6.0

- validation reproductible : 27 tests réussis ;
- suite Pytest : 31 tests réussis ;
- intégration locale SQLite : détection, correction et override réussis ;
- écriture `.env` : conservation des commentaires, paramètres inconnus et
  secrets non remplacés réussie ;
- archive : `motorsports-events-server-2.6.0.zip` ;
- SHA-256 :
  `8d7cf792a76bc4dde77c3a08c307a2ce902a871c29e722f526c5323b8594bb8e` ;
- archive réextraite et retestée : réussie ;
- intégrité ZIP : réussie.

## Validation VPS

La version 2.6.0 est validée sur le VPS le 29 juillet 2026 :

- version locale et API : 2.6.0, build `20260728-214529` ;
- API et PostgreSQL : `healthy` ;
- Caddy et scheduler : actifs ;
- `/api/v1/events` : HTTP 200 et JSON valide ;
- trois incohérences IndyCar corrigées avec overrides actifs ;
- synchronisation manuelle : 0 créée, 243 mises à jour, 0 erreur ;
- aucune incohérence IndyCar/Warmup après synchronisation ;
- modification Web de `LOG_LEVEL=WARNING` réussie ;
- permissions du `.env` conservées à `600` ;
- redémarrage et santé API réussis.

## État Git

- branche stable : `main` ;
- publication 2.5.2 : pull request GitHub `#1` ;
- branche de publication : `agent/publish-2.5.2-handoff` ;
- référence officielle de release : tag annoté `v2.5.2` ;
- publication 2.6.0 : intégrée dans `main` ;
- tag officiel `v2.6.0` publié sur
  `eaa63e2533d71aa4dcaaff46aa745b2e92505e9e` ;
- logs structurés alpha.6 : pull request GitHub `#8`, intégrée dans `main`
  par le commit `6eb45728ed6e1649a038e8cd7e3cf360729c8a69` ;
- rotation des logs alpha.7 : pull request GitHub `#9`, intégrée dans `main`
  par le commit `7ed0dd76a3eaaa6cce36cb084e71be4f25d9c2a9` ;

## Problèmes connus

- trois séances IndyCar ont été reçues d’OCBlackTop avec `end_at < start_at` ;
- `last_provider_data` confirme que les dates erronées proviennent des données
  OCBlackTop et non de leur correction locale ;
- la 2.6.0 les signale et conserve les corrections comme overrides après
  synchronisation ;
- l’éditeur `.env` ne redémarre volontairement pas Docker : l’administrateur
  doit exécuter `sudo ./restart.sh` après enregistrement.

## Exploitation

Les commandes Docker nécessitent actuellement `sudo` sur le VPS :

```bash
sudo ./verify-installation.sh
sudo ./status.sh
```

La mise à niveau conserve `.env`, les données PostgreSQL, une sauvegarde
pré-mise à niveau et un dossier de rollback.
