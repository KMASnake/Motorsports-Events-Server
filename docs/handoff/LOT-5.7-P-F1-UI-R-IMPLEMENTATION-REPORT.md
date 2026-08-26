# Lot 5.7-P-F1-UI-R — rapport d'implémentation

Date : 2026-08-26
Commit de départ : `e1da9b894426b9af263f75de72e8519059e92871`
Commit final : commit contenant ce rapport, à relever par `git rev-parse HEAD`.

## Findings

L'audit de réconciliation contient 19 findings. Le backend est conforme ou conforme mais mal exposé pour les contrats structurants. Les dérives confirmées portent sur l'UX JSON, la hiérarchie de la fiche fournisseur et l'absence de supervision Scheduler sur `/tasks`.

Les deux corrections demandées lors de l'audit mainteneur suivant sont fermées sur la baseline `7cfab5e061a0b79126f61a969a2cb557af17ad0f` :

- liste générale enrichie par agrégation frontend des APIs existantes, avec états neutres lorsque la donnée manque ;
- séparation sémantique stricte entre credential configuré et connexion API non vérifiée.

## Backend conservé

- ProviderAdapter et adaptateurs réels ;
- orchestration d'acquisition et handoff canonique ;
- scheduler persistant, round-robin 3/2/1, leases, fencing et reprise ;
- classes `current`, `recent_catchup`, `deep_history`, finalisation ;
- quota gate, cadence, pacing, Retry-After et backoffs ;
- source entities/changes, corrections et last-known-good ;
- chiffrement des credentials ;
- repository, versions et activation des mappings ;
- bounded runner et preflight zéro crédit.

Corrections backend : **0**. Migrations : **0**.

## Changements UI

1. Sources : détail fournisseur en six onglets métier.
2. Quotas : champs typés pour limites, intervalle, marge et réserve ; synthèse consommation/restant/reset/cadence/éligibilité ; JSON runtime en diagnostic lecture seule.
3. Championnats : table métier simplifiée ; source config et identifiants techniques repliés en avancé.
4. Mapping : synthèse active/versions/« À associer » dans le parcours normal ; éditeur versionné uniquement en avancé.
5. Synchronisation fournisseur : streams et prochaine action issus des APIs existantes.
6. Historique & logs : runs durables et compteurs existants.
7. Synchronisations transverse : terminologie métier et panneau quota/éligibilité explicite.
8. Scheduler : nouvelle page de supervision dynamique sur `/tasks`, sans cron ni action de contournement.
9. Styles : extension du langage MEDS existant, responsive, sans nouvelle identité visuelle.
10. Liste fournisseurs : résumé opérationnel quota, synchronisation, prochaine action et alertes.
11. Connexion : état `Non vérifiée` indépendant du credential, du preflight, de l'URL et de l'activation.

## Fichiers modifiés

- `apps/web/src/App.tsx`
- `apps/web/src/features/provider-acquisition/ProviderAcquisitionPage.tsx`
- `apps/web/src/features/provider-scheduler/SchedulerPage.tsx`
- `apps/web/src/features/provider-scheduler/SchedulerPage.test.tsx`
- `apps/web/src/features/provider-sources/SourcesPage.tsx`
- `apps/web/src/features/provider-sources/SourcesPage.test.tsx`
- `apps/web/src/features/provider-sources/sourcesApi.ts`
- `apps/web/src/features/provider-sources/sourcesApi.test.ts`
- `apps/web/src/styles.css`
- les trois documents UI-R de `docs/handoff/`.

## Validation

- tests ciblés Sources/Synchronisations/Scheduler/API : 42 PASS après corrections mainteneur ;
- non-régression Web complète : 71 PASS après corrections mainteneur ;
- typecheck Web : PASS ;
- lint Web : PASS ;
- build Web : PASS ;
- validation canonique `./scripts/validate-repository.sh` : PASS (33 tests actifs, 18 skips de dépendances/environnement) ;
- `git diff --check` : PASS ;
- aucune commande provider, discovery, sync-now ou bounded runner exécutée ;
- `REAL_PROVIDER_CALLS=0` ;
- `PROVIDER_CREDITS=0`.

## Écart restant

La file métier complète de résolution « À associer » reste hors de ce changement faute d'API de résolution de normalisation démontrée. Aucun moteur concurrent n'a été créé. Cet écart est non bloquant pour la réconciliation autorisée, qui demandait explicitement de le documenter.

## Captures

Aucune capture navigateur n'a été produite : le workflow n'est pas nécessaire à la preuve fonctionnelle ciblée et aucun Playwright n'a été lancé. Le build et les tests de contrat assurent la preuve locale ; la revue visuelle mainteneur reste à effectuer sur le commit final.
