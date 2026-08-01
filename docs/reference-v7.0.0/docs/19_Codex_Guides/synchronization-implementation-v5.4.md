# Guide Codex — Synchronisation v5.4

## Codex peut maintenant implémenter
- scheduler ;
- orchestrateur ;
- workers ;
- adaptateurs fournisseurs ;
- rate limiter ;
- checkpoints ;
- retries ;
- normalisation ;
- matching initial ;
- décisions de fusion ;
- conflits ;
- observabilité ;
- tests d'intégration.

## Ordre recommandé
1. Contrats d'adaptateur.
2. Modèle de run et checkpoints.
3. Stockage brut.
4. Validation et normalisation.
5. Idempotence.
6. Matching.
7. Fusion protégée par overrides.
8. Conflits.
9. Publication.
10. Observabilité et tests de panne.

## Contraintes
- Ne jamais supprimer sur réponse partielle.
- Ne jamais écraser un override actif.
- Ne jamais exposer le fournisseur dans les descriptions publiques.
- Ne jamais journaliser un secret.
- Toute décision canonique doit être explicable.
