# Guide Codex — UI Administration v6.1.3

## Ordre d’implémentation
1. Routes et permissions.
2. Composants partagés : KPI, DataTable, ConfirmDialog, StatusBadge.
3. Sauvegardes.
4. Utilisateurs.
5. Paramètres.
6. Maintenance.
7. Tests Playwright et snapshots 1536×1024.

## Contraintes
- Utiliser exclusivement les tokens de `docs/11_UI_UX/tokens`.
- Ne pas inventer de nouvelle couleur.
- Toutes les mutations doivent gérer loading, success, error et permission denied.
- Les actions sensibles nécessitent confirmation et audit.
- Les captures doivent être comparées aux PNG de `administration-screens-v6.1.3/screens`.
