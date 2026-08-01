# Pipeline CI/CD de référence

## Pull request
1. restauration des dépendances ;
2. format ;
3. lint ;
4. compilation ;
5. tests unitaires ;
6. tests d'intégration ;
7. scan dépendances ;
8. scan secrets ;
9. validation OpenAPI ;
10. build conteneurs.

## Main
- toutes les étapes précédentes ;
- tests E2E ;
- publication artefacts ;
- déploiement intégration ;
- smoke tests.

## Release
- approbation ;
- sauvegarde ;
- migration ;
- déploiement progressif ;
- vérifications ;
- promotion ;
- rollback automatique ou manuel si seuil dépassé.
