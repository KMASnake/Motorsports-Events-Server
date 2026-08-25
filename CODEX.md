# Codex — Instructions de reprise

## Ordre de lecture

Avant toute modification :

1. `PROJECT-HANDBOOK.md` — règles permanentes et architecture normative ;
2. `docs/handoff/PROGRESS.json` — état courant, autorisations et prochaine action ;
3. les ADR pertinents dans `docs/handbook/architecture/` ;
4. les spécifications et preuves pertinentes dans `docs/handoff/`.

Ne pas reconstruire l'état courant depuis `PROJECT_STATUS.md`, `NEXT_STEPS.md`, `PROJECT-STATUS.json`, les anciens handovers ou une conversation. Ces fichiers peuvent rester présents pour compatibilité ou historique, mais `PROGRESS.json` prévaut.

## Règles d'exécution

- ne modifier que le périmètre explicitement autorisé par `PROGRESS.json` ;
- ne jamais contourner une migration, un contrôle de sécurité ou un invariant documenté ;
- ne jamais exposer ni commiter de secret ;
- exécuter les validations adaptées au changement ;
- documenter les commandes, résultats et écarts réellement observés ;
- ne pas fusionner dans `main` sans autorisation explicite ;
- une CI verte, un build ou un déploiement technique ne vaut pas validation mainteneur.

## Mise à jour documentaire

- règle permanente : mettre à jour `PROJECT-HANDBOOK.md` et l'ADR concerné ;
- décision permanente : consigner dans `docs/handbook/DECISIONS.md` ;
- état, validation, autorisation ou prochaine action : mettre à jour uniquement `docs/handoff/PROGRESS.json` ;
- preuves détaillées d'un lot : conserver dans `docs/handoff/` ;
- historique clos : conserver dans `docs/handover/`.
