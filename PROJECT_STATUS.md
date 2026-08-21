# État du projet

## Lot 5.6-I — validation finale terminée, décision mainteneur attendue (21 août 2026)

La recette complète du Lot 5.6-I est PASS. Elle couvre les sous-lots 5.6-A à
5.6-H, les migrations 0016 à 0023 sur PostgreSQL réel avec rollback et
réapplication, les suites API et Web, 17 scénarios Chromium sans skip, les
régressions 5.4/5.5, la sécurité, la reprise inter-processus et le packaging
2.7.0. La matrice finale et l’empreinte de release sont consignées dans
`docs/handoff/LOT-5.6-I-FINAL-VALIDATION.md`.

Le prochain gate est la décision explicite du mainteneur sur la validation
globale du Lot 5.6. En attendant, `sub_lot_5_6.maintainer_validated` et
`merge_authorized` restent à `false`; 5.7, 5.7-P et les lots suivants restent
non autorisés. Aucun changement fonctionnel n’a été introduit par 5.6-I.

## Lot 5.6-H — validé par le mainteneur (21 août 2026)

L’audit mainteneur de l’interface ACP est PASS : 26 PASS, 0 PARTIAL, 0 FAIL
et 0 NOT TESTED. Le sous-lot 5.6-H est explicitement validé. Le P3 hérité de
5.6-G — une query anomalies invalide retourne `[]` au lieu d’un HTTP 400 —
reste une amélioration non bloquante et ne rouvre ni 5.6-G ni 5.6-H.

Le plan approuvé identifie 5.6-I — « recette complète, audit et passation » —
comme dernier sous-lot technique. Seul ce gate de recette et validation finale
est ouvert ; aucune implémentation fonctionnelle 5.6-I n’est autorisée. Le Lot
5.6 global reste non validé et non fusionnable ; 5.7, 5.7-P et les lots
suivants restent interdits.

## Lot 5.6-H — implémenté, en attente d’audit mainteneur (21 août 2026)

L’interface ACP de supervision de l’acquisition fournisseur consomme les API
internes validées de 5.6-G. Elle couvre l’état current/finalization/history, les
runs récents, anomalies et diagnostics source, les corrections et observations
locales, ainsi que les quatre actions opérateur prévues avec confirmations et
retours explicites.

Les 42 tests frontend, 4 scénarios Playwright Chromium, 209 tests API et la
recette PostgreSQL corrections/observations sont verts. Les preuves et captures
sont consignées dans `docs/handoff/LOT-5.6-H-EVIDENCE.md`.

5.6-H attend désormais l’audit mainteneur. 5.6-H n’est pas validé mainteneur,
5.6-I n’est pas autorisé, le Lot 5.6 global reste non validé et non fusionnable,
et 5.7, 5.7-P et les lots suivants restent interdits.

## Lot 5.6-G — validé par le mainteneur (21 août 2026)

L’API interne expose les états d’acquisition, le diagnostic source, les
anomalies, corrections et observations locales ainsi que les quatre actions
ACP prévues. La matrice atteint 26 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED ;
l’audit mainteneur est PASS et 5.6-G est validé.

Un P3 non bloquant reste tracé : une query invalide sur
`GET /api/v1/admin/provider-acquisition/anomalies` retourne actuellement `[]`
au lieu d’un HTTP 400 explicite. Cette observation ne rouvre pas 5.6-G.

Le prochain gate autorise uniquement 5.6-H — interface ACP — conformément au
plan approuvé et au contrat UI. Aucun code 5.6-H n’est commencé par cette
décision. Le Lot 5.6 global reste non validé et non fusionnable ; 5.7, 5.7-P
et les lots suivants restent interdits.

## Lot 5.6-F — validé par le mainteneur (21 août 2026)

La migration additive 0023 sépare durablement les corrections et observations
locales de la donnée source fournisseur. Provenance, valeur source initiale,
raison, acteur, état, révision et timestamps sont bornés et traçables. Les
écritures verrouillent la même entité source que l’acquisition : la source peut
évoluer sans écraser les protections, et les absences restent non destructives.

La matrice 5.6-F atteint 26 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED sur
PostgreSQL réel, avec concurrence, rollback, stale worker, crash et reprise
dans un second processus. Les 206 tests API et les recettes 5.4/5.5/5.6-C/D/E
restent verts. Preuve : `docs/handoff/LOT-5.6-F-EVIDENCE.md`.

L’audit mainteneur est PASS, sans constat ouvert, et 5.6-F est validé. Le
prochain gate autorise uniquement l’implémentation de 5.6-G — API et actions
ACP. Aucun code 5.6-G n’est commencé dans cette décision documentaire. Le Lot
5.6 global reste non validé et non fusionnable, et les Lots 5.7+ restent
interdits.

## Lot 5.6-E — validé par le mainteneur (21 août 2026)

La temporalité et la finalization sont désormais intégrées au commit durable
d’acquisition. Le recalcul automatique ne vise que les entités touchées par le
traversal, tout en utilisant les pairs comparables du même fournisseur,
championnat et type. La hiérarchie conserve la priorité fournisseur, dernière
session, médiane récente, règle adaptateur puis fin civile.

La migration additive `0022_lot56_temporality_finalization` persiste la méthode,
la provenance, l’échantillon ou la règle, la durée calculée et la version de
logique. La grâce est un délai UTC exact, configurable à 30 jours par défaut.
À l’échéance exacte, l’anomalie liée à l’entité est créée idempotemment sans
forcer `completed`; `cancelled` est final et `postponed` recalcule le suivi à
partir de la nouvelle planification.

Preuve : `docs/handoff/LOT-5.6-E-VALIDATION.md`. La preuve PostgreSQL 5.6-E
couvre désormais explicitement `completed` avant J+30 et la reprise durable
entre deux processus Node sans état mémoire partagé : 35 PASS, 0 PARTIAL.
Les recettes PostgreSQL 5.6-C, 5.6-D, 5.4 et 5.5 restent vertes. Le ré-audit
mainteneur est PASS et 5.6-E est validé. Le prochain gate autorise uniquement
l’implémentation de 5.6-F — protection des corrections et observations. Aucun
code 5.6-F n’est encore commencé. Le Lot 5.6 global reste non validé et non
fusionnable, et les Lots 5.7+ restent interdits.

## Lot 5.6-D — validé par le mainteneur (21 août 2026)

Le sous-lot 5.6-C est validé par le mainteneur. L’orchestrateur durable 5.6-D
enchaîne `current_hot`, `current_future`, `recent_catchup`, `deep_history` et
`finalization` sans contourner le scheduler 5.4, son fencing ni le quota gate
5.5. Le current va jusqu’à épuisement futur du fournisseur ; J+30 reste une
priorité hot, jamais une limite d’acquisition.

La migration additive `0019_lot56_durable_orchestration` conserve l’étape
current et les jalons durables d’historique/finalisation. Cinq saisons vides
complètes consécutives terminent l’historique par défaut ; une réponse
partielle, une erreur, un 429, un timeout ou un curseur invalide ne compte
jamais. La réactivation relance immédiatement current sans reconstruire un
historique déjà complet. Les fins théoriques suivent la hiérarchie fournisseur,
dernière session, médiane comparable, règle adaptateur puis jour civil dans le
fuseau fournisseur. Après le délai configurable, une anomalie persistante est
créée sans forcer le statut métier.

Preuve : `docs/handoff/LOT-5.6-D-VALIDATION.md`. Le ré-audit mainteneur est
PASS et 5.6-D est validé. Cette décision ouvre uniquement 5.6-E ; le Lot 5.6
global reste non validé, non fusionnable, et les Lots 5.7+ restent interdits.

Les corrections d’audit utilisent désormais un unique parcours current global,
seule capacité documentée des fournisseurs, puis persistent le périmètre réel
`past`, `current_hot` ou `current_future` de chaque entité via la migration
`0020`. Le millésime et la phase sont dérivés de l’état durable avant toute
requête. La décision « saison vide » repose sur les compteurs cumulés du
traversal complet. Enfin, finalization n’est sélectionné que lorsqu’une entité
non terminée se trouve réellement dans sa fenêtre de grâce.

Le second ré-audit formalise définitivement `current_global` comme unité
fournisseur indivisible : la présence d’entités `current_hot` priorise ce stream
parmi les unités déjà éligibles selon 5.4/5.5, sans créer de cadence ni de
requête future parallèle. La migration `0021` renomme le work class durable et
ajoute un curseur de finalization par saison. Une cible de décembre N reste donc
traitée en janvier N+1 dans la saison N ; plusieurs saisons sont parcourues
cycliquement et équitablement. La médiane utilise au maximum les cinq pairs
comparables les plus récents.

Le gate mainteneur du 21 août 2026 autorise le démarrage de 5.6-E —
temporalité et finalization — conformément au plan d’implémentation approuvé.
Il n’autorise ni 5.6-F, ni 5.7/5.7-P, ni une fusion dans `main`.

## Lot 5.6-C — validé par le mainteneur (15 août 2026)

Le sous-lot 5.6-B est validé par le mainteneur. Le moteur 5.6-C relie les
fondations PostgreSQL 5.6-A aux adaptateurs 5.6-B via la transaction de commit
du scheduler 5.4. Entités, observations, anomalies, journal source et checkpoint
sont cohérents avec le fencing et la lease au moment du commit.

La migration additive `0017` conserve les parents source tardifs et typés. Un
traversal logique couvre désormais toutes ses pages, cumule les présences et
ne déduit les absences qu’à terminaison certaine. Les échecs interceptables et
les traversals orphelins sont clos sans complétude ni checkpoint. Les dates
`strTimestamp` sont classées en début et les dates historiques restent valides.
La migration `0018` ajoute le fencing durable `run_id + lease_generation` : un
worker stale ne peut plus fermer un traversal repris ni créer une anomalie
tardive. La course PostgreSQL A/B correspondante est validée.
Le ré-audit final mainteneur a validé ce sous-lot et autorisé uniquement 5.6-D.

## Lot 5.6-B — validé par le mainteneur (15 août 2026)

Le sous-lot 5.6-A est validé par le mainteneur. Les contrats d'acquisition,
la pagination bornée, la complétude explicite, l'isolation des anomalies et la
reprise saison sur curseur refusé sont implémentés pour OCBlackTop et
TheSportsDB via l'unique frontière HTTP sécurisée. La suite API complète
(191 tests), la recette ciblée Docker (72 tests) et la recette PostgreSQL 5.6-A
sont vertes.

Preuve : `docs/handoff/LOT-5.6-B-VALIDATION.md`. STOP avant 5.6-C : le Lot 5.6
global reste non validé et non fusionnable, et les Lots 5.7+ sont interdits.

Les corrections d’audit attribuent au WRC la stratégie saisonnière OCBlackTop,
refusent toute complétude issue d’une page vide contradictoire, réservent
`cursor_invalid` aux preuves fournisseur explicites et conservent TheSportsDB
v1 selon l’exception mainteneur ADR-0020. La stratégie v2 fantôme est refusée.
Le sous-lot a reçu la validation finale du mainteneur et autorise uniquement
le démarrage de 5.6-C.

## Lot 5.4 — candidat à l'audit mainteneur (12 août 2026)

Le scheduler persistant, ses curseurs, leases, tokens de fencing, mécanismes de
reprise et commandes administrateur sont implémentés. La recette PostgreSQL
isolée, le rollback `0011` et les tests ciblés passent. Aucune ingestion complète
d'événements fournisseur ni aucun moteur de quota du Lot 5.5 n'a été ajouté.

Preuve : `docs/handoff/LOT-5.4-VALIDATION.md`. Le Lot 5.4 n'est pas encore
validé par le mainteneur et aucun développement 5.5 n'est autorisé.

Les corrections demandées à l'audit sont intégrées : restauration durable de
l'état antérieur, fencing de tous les échecs worker, capacité commune aux
sync/discoveries, round-robin 3/2/1 prouvé en PostgreSQL et runtime minimal de
découverte périodique. Une nouvelle validation mainteneur reste obligatoire.

## Lot 5.3 — implémenté, audit mainteneur requis — 2026-08-12

La découverte OCBlackTop/TheSportsDB, les configurations de source proposées,
les associations manuelles, l’historique et les migrations `0009`/`0010` sont
implémentés et validés localement. Les corrections demandées par l’audit
(complétude explicite, quota inconnu bloquant, comptage en erreur,
revalidation à l’adoption et fallback manuel sans découverte ni réseau) sont
intégrées. Le Lot global est à 30 %. Le Lot
5.3 n’est pas encore validé par le mainteneur et aucun travail 5.4 n’est
autorisé.

Preuves : `docs/handoff/LOT-5.3-VALIDATION.md` et
`docs/handoff/PROGRESS.json`.

## Recette Windows Lot 4.3 — 2026-08-11

Le mainteneur a exécuté `scripts\test-lot43-final.cmd` sur Windows. Le
nettoyage ciblé, la chaîne qualité, les données synthétiques, les validateurs
et les 11 scénarios Chromium ont réussi. La pile reste ouverte pour le dernier
contrôle visuel ; cette preuve automatisée ne vaut pas encore validation finale
globale du Lot 4.3.

## Audit final Lot 4.3 — 2026-08-11

L'audit local complet est réussi : migrations, API, corrections, concurrence,
audit atomique, 99 tests unitaires, builds, 11 scénarios Chromium et 51 tests
historiques. Deux écarts CI ont été corrigés : chargement explicite de la
fixture Lot 4.3 avant Chromium et masquage du jeton administrateur généré. La
CI du SHA candidat `b055ec8` est verte sur les six contrôles GitHub Actions.
Restent la recette Windows/globale et la validation finale du mainteneur.

## Correctif d'interface Lot 4.3 — 2026-08-11

La liste des intitulés de session est désormais une combobox explicite et
ouvrable, avec filtrage lors de la saisie et prise en charge des valeurs
inédites. L'intitulé effectif apparaît dans les aperçus Événement. Le
typecheck, les 99 tests unitaires, les builds API/Web/Types, l'audit npm sans
vulnérabilité et les 11 scénarios Chromium sont réussis. Le mainteneur a validé
sur VPS le 2026-08-11 qu'un intitulé inédit est conservé puis reproposé dans la
liste. Cette validation ciblée ne remplace pas l'audit final du Lot 4.3.

## Architecture 8.1 — état courant

- Lot 4.2 validé et fusionné dans `main` le 2026-08-10 ;
- Lot 4.3 Sessions en développement sur `codex/lot-4.3-sessions` ;
- ADR, plan et migration `0004_sessions` validés par le mainteneur ;
- API administrative et publique validées explicitement par le mainteneur sur
  VPS isolé le 2026-08-10 ;
- workflow Corrections Sessions validé explicitement par le mainteneur sur VPS
  isolé le 2026-08-10 : valeurs typées, synchronisation fournisseur,
  résolutions, concurrence et audit atomique ;
- l'interface multi-sessions techniquement validée a été refusée comme modèle
  cible lors de la recette mainteneur du 2026-08-11 ;
- nouveau modèle validé : un Événement représente une Session et reçoit un
  unique intitulé dans une combobox créable, sans origine visible ;
- ADR-0013 et migration réversible `0005_event_session_title` implémentés ;
- API Événement et suggestions, combobox créable et retrait de l'interface
  multi-sessions techniquement validés ;
- implémentation fonctionnelle : 96 % ;
- prochain point d'arrêt : audit final, CI du SHA exact et recette globale.

L'état canonique de l'architecture 8.1 reste `PROJECT-STATUS.json`. Les sections
2.7.0 ci-dessous sont conservées comme historique de production.

Dernière mise à jour : 29 juillet 2026.

## Version retenue

- projet : `motorsports-events-server` ;
- version fonctionnelle : `2.7.0` ;
- jalon : `4.17-stable-release` ;
- build : `20260729-194637` ;
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
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- installation normale : version locale et API `2.7.0-alpha.13`, build
  `20260729-165716` ;
- API et PostgreSQL : sains ;
- scheduler et Caddy : actifs ;
- schéma : `0002_admin_audit_log` ;
- données avant rollback : 13 sports, 243 événements, 1 186 séances et
  3 overrides ;
- sonde volontaire : version attendue
  `2.7.0-alpha.13-rollback-probe`, version exécutée `2.7.0-alpha.13` ;
- écart de version détecté et rollback automatique déclenché ;
- version après rollback : `2.7.0-alpha.13` ;
- données après rollback : 13 sports, 243 événements, 1 186 séances et
  3 overrides ;
- aucune restauration PostgreSQL nécessaire ;
- Prometheus et Grafana redémarrés automatiquement ;
- Grafana reste lié à `127.0.0.1:3000` et Prometheus sans port hôte ;
- archive de sonde :
  `motorsports-events-server-2.7.0-alpha.13-rollback-probe.zip` ;
- SHA-256 de la sonde :
  `e40cf0edb32a412fed8d2d8acad76c7ac6e5a26e2db56d7ce8425615775fdfed`.

## Candidate artefacts de release GitHub

- version : `2.7.0-alpha.14` ;
- sous-jalon : `4.14-release-artifacts` ;
- branche : `feature/release-artifacts` ;
- schéma et contrat API v1 : inchangés.

La candidate construit le ZIP et son SHA-256 dans GitHub Actions uniquement
après réussite des validations applicative et PostgreSQL.

### Validation locale

- contrôle du chaînage des jobs et des fichiers publiés : réussi ;
- suite applicative complète : 66 tests, 4 ignorés et 5 sous-tests réussis ;
- suite PostgreSQL isolée : 4 tests réussis ;
- archive locale : `motorsports-events-server-2.7.0-alpha.14.zip` ;
- archive réextraite et retestée : réussie ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- première exécution GitHub : artefact produit, mais empreinte contenant le
  chemin absolu du runner et donc non portable après téléchargement ;
- correctif : le fichier d’empreinte référence uniquement le nom du ZIP ;
- deuxième exécution GitHub : vérification lancée depuis la racine alors que
  le nom portable doit être résolu depuis `dist/` ;
- correctif : la vérification CI s’exécute désormais dans `dist/` ;
- validation GitHub : suites applicative et PostgreSQL réussies, puis artefact
  construit et vérifié ;
- artefact GitHub :
  `motorsports-events-server-2.7.0-alpha.14.zip` ;
- SHA-256 de l’artefact GitHub :
  `df9aefe59ccaca748b4541b06b8295f8b6ba90c290a282ff36b0678fb1ac24cd` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- empreinte SHA-256 de l’artefact téléchargé : valide ;
- contrôle préalable à la mise à niveau : réussi ;
- version locale et API : `2.7.0-alpha.14`, build `20260729-171443` ;
- arrêt et recréation de la pile complète : réussis sans réseau occupé ni
  avertissement de conteneur orphelin ;
- API et PostgreSQL : sains ;
- scheduler, Caddy, Prometheus et Grafana : actifs ;
- schéma : `0002_admin_audit_log` ;
- données conservées : 13 sports, 243 événements, 1 186 séances et
  3 overrides ;
- Grafana reste lié à `127.0.0.1:3000` et Prometheus sans port hôte ;
- timer de sauvegarde : actif ;
- quota mensuel OCBlackTop épuisé : synchronisation en échec rapide avec
  réponse HTTP 429 correctement journalisée ;
- deux avertissements Grafana non bloquants signalent l’absence des
  répertoires de provisioning `plugins/` et `alerting/`.

## Candidate provisioning Grafana

- version : `2.7.0-alpha.15` ;
- sous-jalon : `4.15-grafana-provisioning` ;
- branche : `agent/grafana-provisioning-cleanup` ;
- schéma et contrat API v1 : inchangés.

La candidate ajoute les répertoires facultatifs `alerting/` et `plugins/` au
montage de provisioning existant. Les répertoires contiennent un marqueur afin
d’être conservés par Git et dans l’archive ZIP. Les ports de supervision et les
provisionings existants restent inchangés.

### Validation locale

- validation du dépôt : réussie avant modification ;
- quatre répertoires de provisioning couverts par un test de non-régression ;
- liaison Grafana à `127.0.0.1:3000` conservée ;
- Prometheus reste sans port hôte ;
- suite complète : 72 tests et 5 sous-tests réussis ;
- archive : `motorsports-events-server-2.7.0-alpha.15.zip` ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- archive réextraite et retestée : réussie ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-alpha.15`, build `20260729-192233` ;
- API et PostgreSQL : sains ;
- scheduler et Caddy : actifs ;
- schéma : `0002_admin_audit_log` ;
- 13 sports accessibles ;
- Prometheus et Grafana : actifs ;
- Grafana lié uniquement à `127.0.0.1:3000` ;
- Prometheus sans port hôte ;
- répertoires `/etc/grafana/provisioning/plugins` et
  `/etc/grafana/provisioning/alerting` présents ;
- aucun message d’erreur de provisioning Grafana détecté.

## Release candidate 2.7.0

- version : `2.7.0-rc.1` ;
- sous-jalon : `4.16-release-candidate` ;
- branche : `agent/release-candidate-2.7.0` ;
- build : `20260729-193421` ;
- schéma : `0002_admin_audit_log` inchangé ;
- contrat API v1 : inchangé.

Cette candidate gèle l’ensemble des fonctions validées jusqu’à l’alpha.15.
Elle n’introduit aucun changement fonctionnel et ajoute uniquement la
checklist de qualification utilisée avant promotion en `2.7.0`.

### Validation locale

- validation du dépôt avant modification : réussie ;
- suite complète : 72 tests et 5 sous-tests réussis ;
- archive : `motorsports-events-server-2.7.0-rc.1.zip` ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- archive réextraite et retestée : réussie ;
- artefact GitHub vérifié, SHA-256 :
  `a0e012499adfdd88a7e1a7b2c8d4e8be6549f5a9dce966fd3eef670f79ccb55f` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0-rc.1`, build `20260729-193421` ;
- API et PostgreSQL : sains ;
- scheduler et Caddy : actifs ;
- schéma : `0002_admin_audit_log` ;
- données conservées : 13 sports, 243 événements, 1 186 séances et
  3 overrides ;
- sondes `/live`, `/ready` et `/metrics` : opérationnelles ;
- Prometheus et Grafana : actifs ;
- Grafana lié uniquement à `127.0.0.1:3000` ;
- Prometheus sans port hôte ;
- timer de sauvegarde : actif et prochaine exécution planifiée ;
- aucune erreur applicative nouvelle détectée ;
- seules erreurs observées : réponses `HTTP 429 Monthly limit exceeded`
  d’OCBlackTop, problème externe connu.

## Candidate stable 2.7.0

- version : `2.7.0` ;
- sous-jalon : `4.17-stable-release` ;
- branche : `agent/release-2.7.0` ;
- build : `20260729-194637` ;
- schéma : `0002_admin_audit_log` inchangé ;
- contrat API v1 : inchangé.

La candidate stable est la promotion de `2.7.0-rc.1`. Aucun fichier
applicatif, aucune migration et aucun contrat ne changent ; seules les
métadonnées et la documentation de publication sont mises à jour.

### Validation locale

- validation du dépôt avant modification : réussie ;
- suite complète : 72 tests et 5 sous-tests réussis ;
- archive : `motorsports-events-server-2.7.0.zip` ;
- SHA-256 : voir le fichier compagnon `.zip.sha256` ;
- archive réextraite et retestée : réussie ;
- artefact GitHub vérifié, SHA-256 :
  `0b4e02064fdfa32380a96a8e662bcff8e56d00b10d8c2039a8898d42385728b8` ;
- validation VPS : réussie le 29 juillet 2026.

### Validation VPS

- version locale et API : `2.7.0`, build `20260729-194637` ;
- API et PostgreSQL : sains ;
- scheduler et Caddy : actifs ;
- schéma : `0002_admin_audit_log` ;
- données conservées : 13 sports, 243 événements, 1 186 séances et
  3 overrides ;
- sondes `/live`, `/ready` et `/metrics` : opérationnelles ;
- Prometheus et Grafana : actifs ;
- Grafana lié uniquement à `127.0.0.1:3000` ;
- Prometheus sans port hôte ;
- timer de sauvegarde : actif et prochaine exécution planifiée ;
- aucune erreur applicative nouvelle détectée ;
- seules erreurs observées : réponses `HTTP 429 Monthly limit exceeded`
  d’OCBlackTop, problème externe connu.

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
- publication 2.7.0 : pull request GitHub `#19`, intégrée dans `main` par le
  commit `c66dfcf6b477395b9cff111860eb9dcb472a5f1b` ;
- tag annoté `v2.7.0` publié sur ce commit ;
- release GitHub :
  `https://github.com/KMASnake/Motorsports-Events-Server/releases/tag/v2.7.0` ;
- SHA-256 de l’archive officielle :
  `683320f45d9a1ca1bd2635a43f6e399361637ebffb074d48212c6a82f82013c9`.

## Problèmes connus

- trois séances IndyCar ont été reçues d’OCBlackTop avec `end_at < start_at` ;
- `last_provider_data` confirme que les dates erronées proviennent des données
  OCBlackTop et non de leur correction locale ;
- la 2.6.0 les signale et conserve les corrections comme overrides après
  synchronisation ;
- l’éditeur `.env` ne redémarre volontairement pas Docker : l’administrateur
  doit exécuter `sudo ./restart.sh` après enregistrement ;
- OCBlackTop refuse actuellement les synchronisations avec une réponse
  `HTTP 429 Monthly limit exceeded` jusqu’au renouvellement du quota.

## Prochaine étape

- la version stable reste `2.7.0` ; la branche 2.7.x est réservée aux
  correctifs confirmés de sécurité, fiabilité et exploitation ;
- le jalon 5 cible la version `3.0.0` et la refonte de l'administration ;
- la feuille de route détaillée est consignée dans `ROADMAP.md` ;
- l'inventaire des écrans, routes et parcours est la première tâche
  d'implémentation ;
- l'ADR 0019 impose la compatibilité `/api/v1`, l'absence d'exposition du
  `.env` brut, la conservation de l'authentification et une qualification
  navigateur, responsive et accessibilité.

## Configuration administrative

- le fichier `.env` brut n’est exposé par aucune route HTTP ;
- les paramètres autorisés restent modifiables depuis `/admin/settings` ;
- les secrets ne sont pas préremplis et une valeur vide les conserve ;
- les paramètres PostgreSQL restent protégés ;
- `/api/v1/admin/client-config` est conservée sous authentification
  administrateur et ne renvoie qu’une configuration client construite,
  incluant volontairement la clé API publique mais aucun secret serveur.

## Exploitation

Les commandes Docker nécessitent actuellement `sudo` sur le VPS :

```bash
sudo ./verify-installation.sh
sudo ./status.sh
```

La mise à niveau conserve `.env`, les données PostgreSQL, une sauvegarde
pré-mise à niveau et un dossier de rollback.
