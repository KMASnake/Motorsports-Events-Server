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

## 2. Qualifier la séance dont la fin précède le début

- [ ] identifier le provider, l'épreuve et la donnée brute ;
- [ ] déterminer si l'erreur vient du provider ou de la normalisation ;
- [ ] définir une politique explicite : rejet, correction ou signalement ;
- [ ] ajouter un test de non-régression avant toute correction.

Critère d'acceptation : la cause est documentée dans une issue et aucun horaire
n'est corrigé silencieusement sans règle métier approuvée.

## 3. Préparer le Jalon 4 — Stabilisation opérationnelle

- [ ] introduire Alembic ;
- [ ] ajouter des tests unitaires providers ;
- [ ] ajouter des tests d'intégration PostgreSQL ;
- [ ] modulariser l'administration ;
- [ ] ajouter des logs structurés ;
- [ ] automatiser et tester les sauvegardes ;
- [ ] définir l'observabilité et les alertes ;
- [ ] renforcer les tests de mise à niveau et de rollback.

Critère d'acceptation : chaque sous-jalon possède une décision, des tests et une
procédure de rollback avant implémentation.
