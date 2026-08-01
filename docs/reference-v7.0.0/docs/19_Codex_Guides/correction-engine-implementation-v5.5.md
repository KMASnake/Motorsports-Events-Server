# Guide Codex — Moteur de correction v5.5

## Codex peut maintenant implémenter
- modèle Correction et Override ;
- workflow de revue ;
- activation et révocation ;
- protection des champs pendant la synchronisation ;
- propositions de réversion ;
- corrections temporaires ;
- corrections en lot ;
- audit et notifications ;
- API administratives ;
- tests unitaires et d'intégration.

## Ordre recommandé
1. Modèle et statuts.
2. Validation des champs.
3. Workflow.
4. Override Manager.
5. Intégration synchronisation.
6. Réversion.
7. Audit.
8. API.
9. Notifications.
10. Tests de concurrence et panne.

## Contraintes
- Jamais deux overrides actifs pour le même champ.
- Jamais de suppression d'historique.
- Jamais de réversion silencieuse.
- Jamais d'écrasement concurrent.
- Jamais d'approbation sans permission.
