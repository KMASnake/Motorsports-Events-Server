# Instructions communes aux assistants

Ce dépôt est la mémoire officielle du projet. Une conversation ChatGPT ou
Codex ne remplace jamais le code, les tests et les documents versionnés.

## Démarrage d'une session

Avant toute modification :

1. lire `PROJECT-HANDBOOK.md`, source de vérité permanente officielle ;
2. lire `AGENTS.md`, `CODEX-HANDBOOK.md`, `PROJECT-STATUS.json`,
   `docs/handoff/PROGRESS.json`, `PROJECT_STATUS.md` et `NEXT_STEPS.md` ;
3. lire `docs/handbook/DECISIONS.md`, tous les ADR permanents et les ADR
   historiques concernés ;
4. lire les spécifications du lot dans `docs/handoff/` ;
5. vérifier l'état Git et les changements non commités ;
6. exécuter `./scripts/validate-repository.sh` ;
7. reprendre la première tâche non terminée sans élargir son périmètre.

## Architecture obligatoire

- `domain/` contient les règles métier pures et ne dépend pas de FastAPI,
  SQLAlchemy ou des providers ;
- `application/` orchestre les cas d'usage ;
- `infrastructure/` contient la persistance et les adaptateurs techniques ;
- `api/` contient le contrat HTTP et ses représentations ;
- les façades historiques restent compatibles jusqu'à une décision explicite.

## Compatibilité

- ne retirer, renommer ou changer le type d'aucun champ de `/api/v1` ;
- ne renommer aucune route de `/api/v1` ;
- un changement incompatible nécessite `/api/v2` ;
- conserver les interfaces providers `fetch(season)` ;
- conserver la classification des courses, sprints et qualifications ;
- ne pas introduire de changement fonctionnel pendant une refactorisation sans
  demande explicite.

## Sécurité et données

- ne jamais commiter `.env`, clé API, mot de passe, sauvegarde ou donnée VPS ;
- ne jamais afficher une clé dans un journal, un test ou une documentation ;
- utiliser `.env.example` uniquement avec des valeurs factices ;
- conserver les sauvegardes et le rollback lors d'une mise à niveau.

## Validation et livraison

Avant toute livraison :

1. exécuter `./scripts/validate-repository.sh` ;
2. vérifier la syntaxe Python et shell ;
3. construire avec `./scripts/build-release.sh` ;
4. réextraire l'archive et relancer les tests depuis son contenu ;
5. vérifier le ZIP et son SHA-256 ;
6. mettre à jour `CHANGELOG.md`, `PROJECT_STATUS.md` et `NEXT_STEPS.md` ;
7. créer un commit explicite et publier par pull request ;
8. après validation VPS, enregistrer les résultats et créer le tag de version.

## Passation

L'assistant sortant met à jour au minimum :

- `PROJECT_STATUS.md` avec les versions, validations et problèmes connus ;
- `NEXT_STEPS.md` avec des tâches ordonnées et leurs critères d'acceptation.

L'assistant entrant ne doit pas supposer qu'une étape décrite uniquement dans
une conversation a été réalisée.

Les règles permanentes appartiennent au Handbook. Les documents de
`docs/handoff/` restent spécifiques aux lots et ne peuvent pas remplacer ou
contredire `PROJECT-HANDBOOK.md`.
