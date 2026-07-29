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
