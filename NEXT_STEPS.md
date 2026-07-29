# Prochaines étapes

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
- [ ] ajouter des logs structurés ;
- [ ] automatiser et tester les sauvegardes ;
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
- [ ] vérifier sur le VPS la connexion, le tableau de bord, les paramètres,
  les incohérences horaires et une synchronisation ;
- [ ] intégrer la pull request après validation VPS.

Critère d’acceptation : les contrats publics et administratifs restent
identiques, aucune refonte visuelle n’est introduite et toutes les actions
d’administration validées en 2.6.0 fonctionnent encore.
