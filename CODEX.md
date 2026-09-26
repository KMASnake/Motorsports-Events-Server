# Codex — différences spécifiques

Les règles communes à tous les assistants sont dans `AGENTS.md`. Codex doit les appliquer intégralement avant les règles ci-dessous.

## Lecture minimale Codex

1. `AGENTS.md` ;
2. `PROJECT-HANDBOOK.md` ;
3. `docs/handoff/PROGRESS.json` ;
4. ADR et contrats du périmètre actif nécessaires à la tâche.

Ne pas reconstruire l'état depuis une conversation, un ancien handover, `PROJECT_STATUS.md`, `PROJECT-STATUS.json` ou `NEXT_STEPS.md`.

## Règles propres à Codex

- commencer par rapporter branche, SHA et worktree avant une modification significative ;
- travailler uniquement dans le périmètre explicitement autorisé par `PROGRESS.json` ou par l'instruction mainteneur courante ;
- exécuter les validations adaptées au changement et rapporter les résultats réellement observés ;
- lorsqu'une dépendance d'environnement empêche une certification obligatoire, arrêter avant commit/push plutôt que de présenter une validation partielle comme complète ;
- ne pas lancer d'appel fournisseur réel, activation Production Preview, onboarding externe ou merge `main` sans autorisation explicite correspondante ;
- à la fin, distinguer clairement code modifié, tests exécutés, opérations externes, commit/push et éléments non validés.

## Documentation Codex

Codex ne maintient aucune source de vérité parallèle. Les mises à jour suivent exclusivement la hiérarchie définie dans `AGENTS.md` et `PROJECT-HANDBOOK.md`.
