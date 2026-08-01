# Guide Codex — Finalisation UI v6.1.4

## Objectif
Atteindre une implémentation frontend reproductible, accessible et testable sur desktop, tablette et mobile.

## Ordre
1. Implémenter les breakpoints et le comportement de navigation.
2. Ajouter les états globaux.
3. Ajouter les attributs ARIA et la gestion du focus.
4. Brancher les données de démonstration.
5. Créer les stories manquantes.
6. Activer Playwright et Axe.
7. Générer les baselines visuelles en 1536×1024.
8. Corriger jusqu’à un ratio de différence <= 1 %.

## Définition de terminé
- aucune violation Axe critique ou sérieuse ;
- navigation clavier complète ;
- tous les écrans testés sur 4 viewports ;
- tous les états globaux couverts ;
- aucun texte tronqué sans alternative ;
- aucune valeur CSS magique hors tokens ;
- screenshots approuvés ;
- documentation et changelog mis à jour.
