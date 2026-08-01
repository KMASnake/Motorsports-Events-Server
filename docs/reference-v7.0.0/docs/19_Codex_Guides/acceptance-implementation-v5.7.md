# Guide Codex — Recette et E2E v5.7

## Codex peut maintenant
- générer les fixtures ;
- automatiser les parcours critiques ;
- bâtir la suite de non-régression ;
- injecter des pannes ;
- lancer les tests de charge ;
- produire les rapports ;
- relier exigences, tests et preuves ;
- préparer les checklists de release.

## Ordre recommandé
1. Fixtures déterministes.
2. Tests API.
3. Tests E2E critiques.
4. Non-régression.
5. Résilience.
6. Performance.
7. Sécurité.
8. Sauvegarde/restauration.
9. Rapport de recette.
10. Pipeline de release candidate.

## Contraintes
- Aucun défaut corrigé sans test.
- Aucun go sans restauration testée.
- Aucun test critique sans preuve.
- Aucun environnement de test avec secret production.
