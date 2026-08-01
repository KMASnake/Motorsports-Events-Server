# Manuel final Codex v6.1

## Règles non négociables
1. Discipline est une entité, pas une chaîne libre du championnat.
2. Championship est le parent obligatoire de Season.
3. Category est facultative et dépend de Championship.
4. `Season.categoryId` reste nullable dans tous les niveaux : DB, domaine, DTO, API et UI.
5. Une catégorie de championnat différent est refusée.
6. L'entité technique d'une épreuve s'appelle `Event`.
7. Une branche complète peut être créée manuellement sans fournisseur.
8. Un mapping fournisseur ultérieur ne change pas l'identité canonique.
9. Le nom du fournisseur ne figure jamais dans les descriptions publiques.

## Cas de référence obligatoires
- Automobile → Formule 1 → Saison 2026 → Grand Prix → Course.
- Moto → MotoGP → Moto2 → Saison 2026 → Grand Prix → Course.
