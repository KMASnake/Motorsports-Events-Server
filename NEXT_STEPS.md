# Prochaines étapes

## Priorité courante — audit mainteneur Lot 5.6-B

- [x] obtenir la validation mainteneur définitive du sous-lot 5.6-A ;
- [x] définir les contrats d'acquisition sans normalisation métier 5.7 ;
- [x] implémenter pagination, terminaison certaine et curseur borné ;
- [x] séparer anomalies élémentaires isolables et flux bloquants ;
- [x] réutiliser exclusivement `providerHttp.ts` et le quota gate 5.5 ;
- [x] valider API, sécurité, Docker et non-régression PostgreSQL 5.6-A ;
- [ ] obtenir l'audit et l'autorisation explicite du mainteneur avant 5.6-C.

Point d'arrêt obligatoire : ne commencer ni le moteur transactionnel 5.6-C,
ni aucune fonctionnalité 5.7+ avant décision explicite du mainteneur.

## Priorité courante — audit mainteneur Lot 5.4

- [x] valider le Lot 5.3 et autoriser explicitement le Lot 5.4 ;
- [x] implémenter le scheduler PostgreSQL, les curseurs et les leases ;
- [x] valider fencing, reprise après crash et atomicité résultat/curseur ;
- [x] valider les commandes administrateur et la découverte périodique ;
- [x] valider la migration `0011` aller/retour sur PostgreSQL réel ;
- [x] corriger les constats d'audit 5.4 et valider la migration additive `0012` ;
- [ ] exécuter la recette `./scripts/test-lot54-scheduler.sh` sur le VPS ;
- [ ] auditer puis valider explicitement le Lot 5.4.

Point d’arrêt obligatoire : aucune tâche 5.5 n’est autorisée.

## Historique — audit mainteneur Lot 5.3

- [x] implémenter la migration `0009_provider_discovery` réversible ;
- [x] implémenter la découverte réelle OCBlackTop et TheSportsDB sans Events ;
- [x] valider lint, types, 118 tests API, 29 tests Web, builds et Docker ;
- [x] corriger les constats de l’audit Lot 5.3 ;
- [x] ajouter le fallback manuel complet, indépendant de la découverte et du réseau ;
- [x] exécuter la recette manuelle avec les credentials réels ;
- [x] auditer puis valider explicitement le Lot 5.3 ;
- [x] autoriser séparément le Lot 5.4 avant tout développement ultérieur.

Le Lot 5.3 est validé par le mainteneur.

## Priorité courante — Lot 4.3 Sessions

- [x] spécifier le périmètre et les critères d'acceptation ;
- [x] proposer l'ADR du modèle Sessions ;
- [x] proposer le plan réversible de migration `0004_sessions` ;
- [x] obtenir la validation explicite de l'ADR et du plan ;
- [x] écrire et tester la migration PostgreSQL `0004_sessions` ;
- [x] vérifier deux démarrages API avec une base forcée en lecture seule ;
- [x] obtenir la validation explicite de la recette migration par le mainteneur ;
- [x] implémenter l'API Sessions administrative et les contrats partagés ;
- [x] valider localement l'étape API sur PostgreSQL/Docker isolé ;
- [x] implémenter et valider l'API publique Sessions ;
- [x] obtenir la validation mainteneur de l'étape API sur VPS isolé ;
- [x] implémenter et valider techniquement le workflow de corrections Sessions ;
- [x] obtenir la validation mainteneur de la recette Corrections sur VPS isolé ;
- [x] implémenter et valider techniquement l'interface Sessions intégrée ;
- [x] recueillir le retour mainteneur rejetant le modèle UI multi-sessions ;
- [x] valider le modèle métier « un Événement = une Session » ;
- [x] rédiger l'ADR-0013 et le plan `0005_event_session_title` ;
- [x] obtenir la validation explicite de ces deux documents ;
- [x] implémenter et tester la migration réversible `0005` ;
- [x] ajouter la combobox créable au formulaire Événement ;
- [x] retirer du parcours UI la sous-liste et le CRUD multi-sessions ;
- [x] remplacer les fixtures et scénarios Chromium devenus obsolètes ;
- [x] valider visuellement sur VPS la création puis la réutilisation d'un
  intitulé inédit dans la combobox explicite ;
- [x] exécuter les recettes VPS isolées et la validation visuelle mainteneur ;
- [x] réaliser l'audit final du Lot 4.3 ;
- [x] obtenir une CI verte sur le SHA candidat exact `b055ec8` ;
- [x] fournir une recette Windows Lot 4.3 autonome avec nettoyage ciblé ;
- [x] exécuter la recette Windows automatisée ;
- [x] terminer les validations VPS isolées et le contrôle visuel Windows ;
- [x] obtenir la validation utilisateur finale du Lot 4.3 ;
- [ ] vérifier la CI sur le dernier SHA documentaire puis fusionner la pull
  request dans `main` ;
- [ ] préparer le démarrage du lot suivant depuis `main` après passation.

Critère de passage atteint le 2026-08-11 : le modèle « un Événement = une
Session », sa combobox et ses aperçus ont été validés sur VPS puis dans la
recette Windows complète. L'implémentation du Lot 4.3 est à 100 % et validée
explicitement ; le prochain point d'arrêt est la fusion contrôlée dans `main`.
Les sections
suivantes sont conservées comme historique des jalons précédents.

## Remédiation de l'audit Lot 4.2

- [x] remplacer le SQL destructif au démarrage par des migrations versionnées ;
- [x] archiver et restaurer les anciennes corrections de fuseau ;
- [x] ajouter le validateur Docker reproductible de l'étape 1 ;
- [x] valider l'étape 1 sur le VPS isolé ;
- [x] implémenter le typage serveur des valeurs de correction ;
- [x] valider l'étape 2 sur le VPS isolé ;
- [x] implémenter et tester la sécurité des routes administratives ;
- [x] valider l'étape 3 sur le VPS isolé ;
- [x] implémenter pagination, validation des filtres et journal d'audit ;
- [x] valider l'étape 4 sur le VPS isolé ;
- [ ] commencer ensuite les tests de concurrence, rollback et calendrier.

L'étape 4 a été validée sur VPS le 2026-08-09 : pagination/tri, filtres `400`,
unicité fournisseur et journal sans secret ont tous réussi.

L'étape 3 a été validée sur VPS le 2026-08-09 : `401`, `403`, jetons
invalides/expirés, administrateur autorisé et API publique ont tous réussi.

Critère d'acceptation atteint le 2026-08-09 : le validateur de l'étape 1 a
réussi sur le VPS. L'étape 2 a également été validée sur VPS le 2026-08-09.
Prochaine tâche : étape 3, preuves de sécurité des routes administratives.

## Lot 4.2 — validation et publication

- [x] implémenter les vues Mois, Semaine, Jour et Agenda ;
- [x] implémenter déplacement, redimensionnement, création rapide,
  duplication, rollback et avertissement de conflit ;
- [x] implémenter les corrections fournisseur champ par champ ;
- [x] ajouter l'identité locale, le registre d'assets et les fallbacks ;
- [x] ajouter la chaîne hybride sécurisée et le générateur déterministe ;
- [x] valider unités, builds, PostgreSQL, Docker et Chromium localement ;
- [ ] publier la pull request Lot 4.2 ;
- [x] installer le package dans un projet Docker VPS isolé ;
- [x] valider sur VPS l'affichage des identités sportives et des drapeaux ;
- [x] embarquer le jeu complet de drapeaux et supprimer la whitelist pays ;
- [ ] valider sur VPS un pays absent de l'ancien jeu limité ;
- [ ] valider sur VPS la légende dynamique sous le calendrier mensuel ;
- [ ] valider sur VPS que les flèches avancent d'un jour en vue Jour et de sept
  jours en vue Semaine ;
- [x] régénérer les données VPS puis valider qu'une modification d'un événement
  fournisseur apparaît dans la page Corrections ;
- [x] vérifier sur VPS qu'une correction de circuit affiche les deux noms de
  circuits et non leurs identifiants techniques ;
- [x] valider sur VPS les filtres Fournisseur des pages Événements et
  Corrections ainsi que leur réinitialisation ;
- [x] confirmer sur VPS que les trois libellés sont OC BlackTop, TheSportsDB et
  Motorsports Events, notamment pour un ajout manuel ;
- [x] injecter sur VPS une source synthétique supplémentaire et confirmer son
  apparition automatique dans les deux filtres Fournisseur ;
- [ ] vérifier sur VPS les logos locaux et configurés dans la page Championnats ;
- [ ] exécuter la recette manuelle Windows et consigner le résultat ;
- [ ] fusionner seulement après validation utilisateur.

Critère d'acceptation : toutes les checklists Lot 4.2 sont validées sans secret
ni écriture vers la production, avec une API publique inchangée.

Les tâches sont classées par priorité. Ne commencer une tâche que lorsque la
précédente est terminée ou explicitement différée.

## 1. Publier officiellement la 2.5.2

- [x] faire relire et intégrer la pull request du Jalon 3 ;
- [x] vérifier la branche `main` après intégration ;
- [x] créer et pousser le tag annoté `v2.5.2` ;
- [x] reporter la pull request et le tag dans `PROJECT_STATUS.md`.

Critère d'acceptation : `main` contient exactement la version validée sur VPS,
le tag `v2.5.2` pointe sur cette version et la validation GitHub réussit.

## 2. Valider la 2.6.0

- [x] signaler les séances dont la fin précède le début ;
- [x] permettre leur correction manuelle sans correction silencieuse ;
- [x] conserver la correction comme override après synchronisation ;
- [x] permettre l’édition contrôlée du `.env` depuis l’administration ;
- [x] installer l’archive candidate sur le VPS ;
- [x] valider le signalement et la correction d’une anomalie ;
- [x] valider la modification d’un paramètre non sensible puis le redémarrage ;
- [x] vérifier santé, événements et synchronisation ;
- [x] reporter les résultats VPS dans `PROJECT_STATUS.md`.

Critère d'acceptation : les deux fonctions sont validées sur le VPS, la
synchronisation ne réintroduit pas l’horaire corrigé et les contrats API
publics restent inchangés.

## 3. Publier la 2.6.0

- [x] intégrer la version validée dans `main` ;
- [x] créer le tag annoté `v2.6.0` sur le commit validé ;
- [x] pousser le tag `v2.6.0` sur GitHub ;
- [ ] reporter le commit et le tag dans `PROJECT_STATUS.md`.

## 4. Valider le sous-jalon Alembic

- [x] ajouter Alembic et une migration initiale complète ;
- [x] ajouter un service de migration avant l’API et le scheduler ;
- [x] adopter sans perte une base 2.6.0 existante ;
- [x] refuser un schéma incomplet ou une révision incorrecte ;
- [x] tester SQLite et PostgreSQL 16 localement ;
- [x] installer `2.7.0-alpha.1` sur le VPS ;
- [x] vérifier la révision `0001_initial_schema` ;
- [x] vérifier santé, données, synchronisation et rollback ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : la base VPS conserve toutes ses données, possède la
révision attendue et les services restent sains après mise à niveau.

## 5. Valider le sous-jalon qualité providers

- [x] tester OCBlackTop sans réseau externe ;
- [x] tester TheSportsDB sans réseau externe ;
- [x] couvrir pagination, normalisation, statuts et erreurs ;
- [x] mesurer la couverture des providers ;
- [x] imposer un seuil minimal de 85 % dans la CI ;
- [x] installer `2.7.0-alpha.2` sur le VPS ;
- [x] tester les deux providers depuis l’administration ;
- [x] exécuter une synchronisation complète sans erreur ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : la CI maintient au moins 85 % de couverture providers,
les tests administratifs réussissent et la synchronisation VPS reste sans
erreur.

## 6. Valider le sous-jalon PostgreSQL

- [x] créer un environnement PostgreSQL 16 isolé ;
- [x] tester une base vierge et une base existante ;
- [x] ajouter un jeu IndyCar versionné ;
- [x] tester persistance, synchronisation et override ;
- [x] intégrer le test à GitHub Actions ;
- [x] installer `2.7.0-alpha.3` sur le VPS ;
- [x] vérifier version, schéma, santé et synchronisation ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : les tests Docker passent dans GitHub Actions, la
candidate reste saine sur le VPS et aucune donnée de production n’est utilisée
par l’environnement de test.

## 7. Qualifier l’origine de l’anomalie horaire

- [x] identifier le provider, les épreuves et les données brutes ;
- [x] déterminer si l’erreur vient du provider ou de la normalisation ;
- [ ] documenter la cause dans une issue.

## 8. Poursuivre le Jalon 4 — Stabilisation opérationnelle

- [x] introduire Alembic ;
- [x] ajouter des tests unitaires providers ;
- [x] ajouter des tests d'intégration PostgreSQL ;
- [x] modulariser l'administration ;
- [x] ajouter des logs structurés ;
- [x] automatiser et tester les sauvegardes ;
- [ ] définir l'observabilité et les alertes ;
- [ ] renforcer les tests de mise à niveau et de rollback.

Critère d'acceptation : chaque sous-jalon possède une décision, des tests et une
procédure de rollback avant implémentation.

## 9. Valider l’administration modulaire

- [x] isoler les routes administratives de `app.main` ;
- [x] conserver une façade unique d’inclusion des routeurs ;
- [x] préserver les chemins, méthodes HTTP et réponses ;
- [x] ajouter un test de frontière d’architecture ;
- [x] construire et réextraire l’archive `2.7.0-alpha.4` ;
- [x] vérifier sur le VPS la connexion, le tableau de bord, les paramètres,
  les incohérences horaires et une synchronisation ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : les contrats publics et administratifs restent
identiques, aucune refonte visuelle n’est introduite et toutes les actions
d’administration validées en 2.6.0 fonctionnent encore.

## 10. Valider le journal d’administration

- [x] ajouter la migration `0002_admin_audit_log` ;
- [x] enregistrer les actions administratives sensibles ;
- [x] exclure les valeurs `.env`, clés API et cookies ;
- [x] ajouter la page `/admin/audit` et l’API protégée ;
- [x] tester une base vierge et la migration depuis `0001` ;
- [x] construire, réextraire et retester l’archive alpha.5 ;
- [x] installer `2.7.0-alpha.5` sur le VPS ;
- [x] vérifier les entrées produites et l’absence de secrets ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : les actions prévues sont persistées, consultables par
un administrateur et ne contiennent aucune valeur sensible.

## 11. Valider les logs structurés JSON

- [x] ajouter un formateur JSON commun ;
- [x] corréler les requêtes HTTP par identifiant ;
- [x] structurer les événements de synchronisation ;
- [x] désactiver les accès Uvicorn en texte ;
- [x] masquer les champs et valeurs sensibles ;
- [x] empêcher les synchronisations concurrentes entre API et scheduler ;
- [x] supprimer l’attente longue sur quota mensuel OCBlackTop ;
- [x] récupérer automatiquement les exécutions `running` orphelines ;
- [x] construire, réextraire et retester l’archive alpha.6 ;
- [x] installer `2.7.0-alpha.6` sur le VPS ;
- [x] vérifier l’échec rapide sur quota mensuel OCBlackTop ;
- [x] vérifier la récupération des synchronisations orphelines ;
- [x] vérifier que les lignes API et scheduler sont du JSON valide ;
- [x] vérifier les événements HTTP et de synchronisation ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : les logs applicatifs sont des objets JSON valides,
corrélables, sans secret et exploitables par un collecteur externe.

## 12. Valider la rotation des logs Docker

- [x] définir une politique commune à tous les services ;
- [x] limiter la taille et le nombre de fichiers ;
- [x] compresser les fichiers tournés ;
- [x] ajouter un test de non-régression de la configuration ;
- [x] construire, réextraire et retester l’archive alpha.7 ;
- [x] installer `2.7.0-alpha.7` sur le VPS ;
- [x] vérifier les options réelles des cinq conteneurs ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : chaque conteneur utilise `json-file`, `max-size=10m`,
`max-file=5` et `compress=true`, sans changement du contrat API ni du schéma.

## 13. Valider les sauvegardes automatisées

- [x] rendre la création atomique et les fichiers privés ;
- [x] vérifier chaque archive par restauration PostgreSQL temporaire ;
- [x] sécuriser le redémarrage après une restauration échouée ;
- [x] rendre la rétention configurable ;
- [x] fournir un timer systemd quotidien et persistant ;
- [x] tester le flux avec un environnement déterministe ;
- [x] construire, réextraire et retester l’archive alpha.8 ;
- [x] installer `2.7.0-alpha.8` sur le VPS ;
- [x] installer et contrôler le timer ;
- [x] créer puis vérifier une sauvegarde réelle ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : une sauvegarde quotidienne est créée en mode `0600`,
restaurée avec succès dans une base temporaire, soumise à rétention et
rattrapée après une indisponibilité du VPS.

## 14. Valider le contrôle préalable aux mises à niveau

- [x] contrôler archive, outils, Docker, Compose, `.env` et espace disque ;
- [x] exécuter le contrôle avant toute écriture ou interruption ;
- [x] tester l’ordre d’exécution et les contrôles obligatoires ;
- [x] construire et retester l’archive alpha.9 ;
- [x] installer et valider l’alpha.9 sur le VPS ;
- [ ] intégrer la pull request après validation VPS.

## 15. Valider les endpoints d’observabilité

- [x] ajouter `/live`, `/ready` et `/metrics` ;
- [x] vérifier PostgreSQL dans la readiness ;
- [x] borner les labels et exclure les secrets ;
- [x] construire et retester l’archive alpha.10 ;
- [x] installer et valider l’alpha.10 sur le VPS ;
- [ ] intégrer la pull request après validation VPS.

## 16. Valider la supervision privée

- [x] ajouter Prometheus sans port public ;
- [x] lier Grafana uniquement à `127.0.0.1:3000` ;
- [x] imposer un mot de passe et désactiver les inscriptions ;
- [x] provisionner la source et le tableau de bord API ;
- [x] tester la confidentialité de la configuration ;
- [x] construire et retester l’archive alpha.11 ;
- [x] installer et valider l’alpha.11 sur le VPS ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : Prometheus collecte l’API, Grafana reste lié à
localhost, le tableau provisionné affiche la disponibilité, l’uptime, les
requêtes et un taux d’erreurs nul.

## 17. Valider les alertes locales

- [x] définir les seuils et délais dans un ADR ;
- [x] ajouter les règles Prometheus ;
- [x] afficher les alertes actives dans Grafana ;
- [x] corriger la couleur trompeuse de l’uptime ;
- [x] construire et retester l’archive alpha.12 ;
- [x] installer et valider l’alpha.12 sur le VPS ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : les règles sont chargées sans erreur, aucune alerte
n’est active en fonctionnement nominal, une indisponibilité contrôlée fait
passer l’alerte attendue à l’état actif et aucun port supplémentaire n’est
exposé.

## 18. Valider le rollback reproductible

- [x] isoler les opérations de bascule de fichiers ;
- [x] simuler l’échec d’une candidate avec une donnée persistante ;
- [x] vérifier le retour à l’ancienne version et la conservation de la donnée ;
- [x] refuser un état ambigu avec deux répertoires `data/` ;
- [x] conserver l’état actif ou inactif de la supervision ;
- [x] construire et retester l’archive alpha.13 ;
- [x] installer et provoquer un rollback contrôlé sur le VPS ;
- [x] vérifier version, données, sauvegarde et supervision après rollback ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : une candidate volontairement invalide déclenche le
rollback automatique, l’ancienne version et les données réapparaissent, la
supervision retrouve son état initial et aucune restauration PostgreSQL n’est
nécessaire.

## 19. Valider les artefacts de release GitHub

- [x] faire dépendre la construction des suites applicative et PostgreSQL ;
- [x] utiliser `scripts/build-release.sh` comme unique constructeur ;
- [x] vérifier automatiquement le SHA-256 ;
- [x] publier le ZIP et son empreinte dans le même artefact ;
- [x] échouer lorsque les fichiers attendus sont absents ;
- [x] valider le job sur la pull request alpha.14 ;
- [x] installer l’artefact GitHub sur le VPS ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : GitHub ne publie l’artefact qu’après réussite des deux
suites, le ZIP téléchargé correspond à son SHA-256 et cette archive s’installe
sur le VPS sans différence avec une archive locale.

## 20. Nettoyer le provisioning Grafana

- [x] créer les répertoires de provisioning facultatifs `plugins/` et
  `alerting/` dans l’image ou le montage Grafana ;
- [x] vérifier que Grafana démarre sans erreur de provisioning ;
- [x] conserver la liaison privée à `127.0.0.1:3000`.
- [x] installer et valider l’alpha.15 sur le VPS ;
- [x] intégrer la pull request après validation VPS.

Critère d’acceptation : le démarrage de Grafana ne produit plus d’erreur liée
aux répertoires de provisioning absents et aucun port de supervision
supplémentaire n’est exposé.

## 21. Qualifier la release candidate 2.7.0

- [x] geler les fonctionnalités du jalon 4 ;
- [x] ajouter une checklist de qualification reproductible ;
- [x] exécuter les suites applicative et PostgreSQL ;
- [x] construire et retester l’archive `2.7.0-rc.1` ;
- [x] valider l’artefact GitHub sur le VPS ;
- [x] vérifier les données, services, sondes et sauvegardes ;
- [x] intégrer la pull request après validation VPS ;
- [x] promouvoir la candidate validée en `2.7.0`.

Critère d’acceptation : la RC ne contient aucun changement fonctionnel après
l’alpha.15, toutes les validations de `docs/release-checklist.md` réussissent
et les données de production sont conservées.

## 22. Publier la version stable 2.7.0

- [x] aligner les versions racine, serveur et Compose sur `2.7.0` ;
- [x] exécuter les suites applicative et PostgreSQL ;
- [x] construire et retester l’archive stable ;
- [x] installer l’artefact GitHub stable sur le VPS ;
- [x] vérifier version, données, services, sondes et sauvegardes ;
- [x] intégrer la pull request dans `main` ;
- [x] créer et pousser le tag annoté `v2.7.0` ;
- [x] publier la release GitHub avec le ZIP et son SHA-256.

Critère d’acceptation : l’artefact stable est identique fonctionnellement à la
RC qualifiée, s’installe sans perte sur le VPS et le tag `v2.7.0` désigne
exactement le commit publié dans `main`.

## 23. Assurer le suivi post-release 2.7.0

- [ ] contrôler la première sauvegarde quotidienne créée après la release ;
- [ ] vérifier sa restauration dans l'environnement temporaire prévu ;
- [ ] revalider une synchronisation OCBlackTop après renouvellement du quota ;
- [ ] consigner toute régression confirmée avant d'ouvrir une maintenance
  2.7.x.

Le contrôle OCBlackTop est différé jusqu'au renouvellement du quota externe.
Ce suivi de production reste continu et ne bloque pas le travail documentaire
du jalon 5.

Critère d'acceptation : la sauvegarde post-release est vérifiée, OCBlackTop
reprend sans anomalie après renouvellement et toute correction 2.7.x reste
strictement compatible avec `/api/v1`.

## 24. Cadrer le jalon 5 — Administration 3.0.0

- [x] détailler les phases et critères dans `ROADMAP.md` ;
- [x] consigner les contraintes dans l'ADR 0019 ;
- [ ] inventorier les pages, routes, actions, formulaires et états actuels ;
- [ ] documenter les parcours et besoins de l'administrateur ;
- [ ] choisir l'outillage de tests navigateur et d'accessibilité ;
- [ ] produire les premières maquettes desktop et mobile ;
- [ ] découper l'implémentation en pull requests indépendantes.

Critère d'acceptation : l'inventaire relie chaque écran à ses routes et
actions, les maquettes couvrent les parcours prioritaires, les contrôles de
sécurité et d'accessibilité sont testables et aucune implémentation ne change
le contrat `/api/v1`.
