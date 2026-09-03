# Instructions communes aux assistants

`AGENTS.md` est le contrat commun minimal pour les assistants qui modifient ce dépôt. Il ne duplique ni les règles métier permanentes ni l'état courant.

## Sources à lire

Avant toute modification :

1. `PROJECT-HANDBOOK.md` — règles permanentes, invariants et architecture normative ;
2. `docs/handoff/PROGRESS.json` — unique source canonique de l'état courant, des validations, autorisations, interdictions et de la prochaine action ;
3. les ADR applicables dans `docs/handbook/architecture/` ;
4. les contrats du périmètre actif dans `docs/handoff/` ;
5. les instructions propres à l'outil utilisé, par exemple `CODEX.md` pour Codex.

Les pointeurs de compatibilité `PROJECT_STATUS.md`, `PROJECT-STATUS.json` et `NEXT_STEPS.md`, les archives et les conversations ne doivent jamais servir à reconstruire l'état courant.

## Avant d'écrire

- vérifier la branche, le SHA et l'état du worktree ;
- respecter strictement le périmètre autorisé dans `PROGRESS.json` ;
- ne pas introduire de changement fonctionnel dans une refactorisation ou un cleanup sans autorisation explicite ;
- identifier les validations adaptées au changement avant de modifier le dépôt.

## Invariants communs

- ne jamais commiter ou exposer `.env`, clé API, mot de passe, token, sauvegarde ou donnée VPS sensible ;
- préserver les contrats publics versionnés et l'historique des migrations ;
- ne pas contourner les contrôles de sécurité, sauvegarde, rollback, audit ou contrôle d'accès ;
- ne jamais interpréter une CI verte, un build, un déploiement ou un merge comme une validation mainteneur ;
- ne pas fusionner dans `main` sans autorisation explicite de l'état canonique.

## Documentation

- règle permanente : `PROJECT-HANDBOOK.md` et, si nécessaire, ADR correspondant ;
- décision permanente : `docs/handbook/DECISIONS.md` et ADR correspondant ;
- état, validation, autorisation, interdiction ou prochaine action : uniquement `docs/handoff/PROGRESS.json` ;
- contrat/preuve du périmètre actif : `docs/handoff/` ;
- preuve historique clôturée : `docs/archive/`.

Les fichiers propres à un assistant doivent uniquement ajouter les différences nécessaires à cet assistant et ne doivent pas recopier ces règles communes.