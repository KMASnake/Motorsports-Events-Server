# Ordre d'implémentation recommandé pour Codex

## Autorisé dès v5.1
1. Créer les types et identifiants du domaine.
2. Créer les entités sans persistance définitive.
3. Créer les énumérations de statut.
4. Créer les événements de domaine.
5. Créer les interfaces des services.
6. Mettre en place des tests unitaires d'invariants.

## À différer
- Mapping SQL définitif.
- OpenAPI public définitif.
- Algorithme final de matching et fusion.
- Politiques de sécurité définitives.
- Orchestration complète des fournisseurs.

## Règle
Codex ne doit pas inventer une règle métier absente. Il doit ouvrir une issue
`specification-needed` avec la question et l'impact.
