# Guide Codex — écrans opérationnels v6.1.2

## Ordre recommandé
1. Réutiliser exclusivement les tokens dans `docs/11_UI_UX/tokens/`.
2. Construire un `OperationsPageShell` partagé.
3. Implémenter Circuits, API, Observabilité puis Journaux.
4. Brancher des fixtures conformes à `contracts/frontend-contracts.json`.
5. Ajouter les stories et tests d’interaction avant connexion backend.

## Interdictions
- Ne pas inventer de nouvelles couleurs, tailles ou rayons.
- Ne jamais afficher un secret API après l’écran de création.
- Ne jamais journaliser de token, mot de passe ou en-tête Authorization.
- Ne jamais afficher le nom du fournisseur de données dans les descriptions publiques.

## Definition of Done
- conformité visuelle aux PNG 1536×1024 ;
- navigation clavier et focus visible ;
- états loading, empty, error, forbidden et stale ;
- TypeScript strict sans `any` non justifié ;
- tests des permissions et actions destructives ;
- aucun secret dans les snapshots ou fixtures.
