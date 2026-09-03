# Documentation active du lot courant

Ce répertoire contient les contrats et preuves du périmètre actif. Il ne définit pas lui-même l'état d'exécution.

## Source canonique de l'état

- [PROGRESS.json](PROGRESS.json) — unique source canonique pour le lot/gate courant, les validations, les autorisations, les interdictions et la prochaine action.

Les statuts éventuellement présents dans les en-têtes des autres documents sont descriptifs et ne prévalent jamais sur `PROGRESS.json`.

## Lot 5.7-P — contrats techniques

- [Technical design](LOT-5.7-P-TECHNICAL-DESIGN.md)
- [Technical acceptance](LOT-5.7-P-TECHNICAL-ACCEPTANCE.md)
- [Technical gates](LOT-5.7-P-GATES.md)

## 5.7-P-F — dossier de preuve et d'exploitation

- [Implementation evidence](LOT-5.7-P-F-IMPLEMENTATION.md)
- [Bounded one-shot provider runner](LOT-5.7-P-F-BOUNDED-PROVIDER-RUNNER.md)
- [Bounded runner VPS certification protocol](LOT-5.7-P-F-BOUNDED-RUNNER-VPS-CERTIFICATION.md)
- [Staging infrastructure persistence](LOT-5.7-P-F-STAGING-PERSISTENCE.md)
- [API/worker isolation correction](LOT-5.7-P-F-WORKER-ISOLATION-CORRECTION.md)

## Contrats fournisseurs structurants encore actifs

Les contrats de fond qui restent applicables au périmètre actif sont conservés dans ce répertoire, notamment les documents `LOT-5-PROVIDERS-SYNC-*`, 5.3 Discovery, 5.4 Scheduler, 5.5 Quota/Cadence et 5.6 Acquisition.

## Historique

Les preuves et documents clôturés sont conservés sous [docs/archive](../archive/README.md). Ils ne constituent jamais l'état courant.

Pour les règles permanentes du projet, revenir au [Project Handbook](../../PROJECT-HANDBOOK.md).