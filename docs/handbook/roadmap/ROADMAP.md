# Roadmap

Ce document décrit la trajectoire fonctionnelle du projet. Il ne constitue **pas** une source de vérité pour l'état d'exécution, les validations, les autorisations ou la prochaine action.

La source canonique de l'état courant est exclusivement `docs/handoff/PROGRESS.json`.

## Lots réalisés ou structurants

- Lot 4.1 : validé.
- Lot 4.2 : validé.
- Lot 4.3 : validé utilisateur et fusionné dans `main` via PR #27 le 2026-08-11.
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12.
- Lot 5 : fournisseurs et moteur de synchronisation API.

## Lot 5 — trajectoire

Le Lot 5 couvre progressivement :

- 5.1 — DB + contrats ;
- 5.2 — secrets et configuration fournisseur ;
- 5.3 — découverte championnats et source config ;
- 5.4 — scheduler persistant, curseurs et leases ;
- 5.5 — quotas et cadence ;
- 5.6 — acquisition fournisseur durable ;
- 5.7-P — tranche verticale Production Preview ;
- 5.7 — normalisation, idempotence, mappings, corrections et présence fournisseur ;
- 5.8 — runs, logs et alertes complets ;
- 5.9 — interface Fournisseurs fidèle aux maquettes validées ;
- 5.10 — acceptation finale.

Les documents normatifs de conception et d'acceptation restent dans `docs/handoff/` tant qu'ils appartiennent au périmètre actif. Les preuves et documents clôturés sont déplacés dans `docs/archive/` selon les règles de conservation du projet.

## Règle de lecture

Pour savoir ce qui est actuellement terminé, validé, autorisé, interdit ou attendu : lire `docs/handoff/PROGRESS.json`.

Pour les règles permanentes : lire `PROJECT-HANDBOOK.md` et `docs/handbook/`.

Pour les décisions permanentes : lire `docs/handbook/DECISIONS.md` et les ADR applicables.

Ce fichier ne doit plus contenir de `status`, de gate courant, de stop rule opérationnelle, de SHA de validation courant ni de prochaine action : ces informations évolutives appartiennent à `docs/handoff/PROGRESS.json`.