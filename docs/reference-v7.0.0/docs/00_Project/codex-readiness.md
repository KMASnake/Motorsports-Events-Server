# État de préparation Codex v6.1

## Score : 100 %

Codex dispose des entités, invariants, contraintes SQL, endpoints, DTO, écrans, ordre de réalisation,
scénarios de test, politiques de synchronisation, règles de correction, procédures d'exploitation et
décisions d'architecture nécessaires.

## Garde-fous
- ne jamais rendre `category_id` obligatoire ;
- ne jamais créer une catégorie implicite pour un championnat sans catégorie ;
- valider que toute catégorie sélectionnée appartient au championnat ;
- conserver la provenance technique hors des descriptions publiques ;
- permettre la création manuelle complète sans fournisseur.
