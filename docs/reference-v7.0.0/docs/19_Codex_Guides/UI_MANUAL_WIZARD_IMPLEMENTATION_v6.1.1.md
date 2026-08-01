# Guide Codex — Assistant de création manuelle v6.1.1

## Périmètre autorisé

Codex peut implémenter les sept étapes de l’assistant en se fondant exclusivement sur :

1. `docs/11_UI_UX/manual-creation-wizard-v6.1.1/specification.md`
2. `docs/11_UI_UX/manual-creation-wizard-v6.1.1/screens/*.png`
3. `docs/11_UI_UX/pixel-spec-v6.1.md`
4. `docs/11_UI_UX/component-states-v6.1.md`
5. `docs/11_UI_UX/tokens/`

## Interdictions

- Ne pas redessiner le layout.
- Ne pas inventer de couleurs, dimensions ou états.
- Ne jamais rendre un fournisseur obligatoire.
- Ne jamais mentionner un fournisseur dans le contenu public.
- Ne pas publier partiellement la branche.
- Ne pas rendre la catégorie obligatoire.

## Ordre de réalisation

1. Tokens et primitives.
2. Shell de console.
3. Stepper accessible.
4. Store de brouillon.
5. Étapes 1 à 7.
6. Validation métier partagée.
7. Endpoint transactionnel et contrat OpenAPI.
8. Tests unitaires, interactions Storybook et E2E.
9. Comparaison visuelle avec les sept PNG.

## Definition of Done

- Différence visuelle <= 2 px sur les repères structurants.
- Aucun contraste inférieur à WCAG AA.
- Parcours complet clavier.
- Données conservées après retour arrière.
- Publication idempotente et atomique.
- Rollback intégral en cas d’échec.
- Tests des trois parcours : sans catégorie, catégorie existante, nouvelle catégorie.
- Aucun texte public ne contient le nom d’un fournisseur ou d’une API.
