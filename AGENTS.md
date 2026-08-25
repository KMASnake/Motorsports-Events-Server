# Instructions communes aux assistants

Ce dépôt est la mémoire officielle du projet. Une conversation ChatGPT ou Codex ne remplace jamais le code, les tests et les documents versionnés.

## Sources de vérité

Deux niveaux seulement sont actifs :

1. `PROJECT-HANDBOOK.md` — règles permanentes, invariants et architecture normative ;
2. `docs/handoff/PROGRESS.json` — état courant, autorisations, prochaine action et validation du lot en cours.

`docs/handbook/DECISIONS.md` et les ADR de `docs/handbook/architecture/` expliquent et historisent les décisions permanentes. `docs/handoff/` contient les contrats et preuves du lot courant. `docs/handover/` et `docs/decisions/` sont historiques et ne doivent jamais être interprétés comme l'état courant.

Les fichiers racine `PROJECT-STATUS.json`, `PROJECT_STATUS.md`, `NEXT_STEPS.md` et `DECISIONS.md` sont uniquement des points de compatibilité/documentation ; ils ne constituent plus des sources de vérité.

## Démarrage d'une session

Avant toute modification :

1. lire `PROJECT-HANDBOOK.md` ;
2. lire `docs/handoff/PROGRESS.json` ;
3. lire les ADR permanents et la documentation du lot concerné ;
4. vérifier l'état Git et les changements non commités ;
5. exécuter `./scripts/validate-repository.sh` lorsqu'il est applicable ;
6. reprendre uniquement la prochaine action autorisée par `PROGRESS.json`.

## Principes permanents

- ne pas introduire de changement fonctionnel pendant une refactorisation sans demande explicite ;
- ne jamais commiter `.env`, clé API, mot de passe, sauvegarde ou donnée VPS ;
- ne jamais afficher un secret dans un journal, un test ou une documentation ;
- préserver les contrats publics versionnés et les migrations historiques ;
- conserver les mécanismes de sauvegarde, rollback, audit et contrôle d'accès ;
- une CI verte, un build réussi, un déploiement ou un merge ne remplacent jamais une validation explicite du mainteneur.

## Documentation

Toute règle durable doit être portée par le Handbook et, lorsqu'elle représente une décision d'architecture, par l'ADR correspondant. L'état courant ne doit être écrit qu'une fois dans `docs/handoff/PROGRESS.json`.
