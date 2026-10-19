# Lot 5.7-P-F1-UI-R — acceptation de la réconciliation

Date : 2026-08-26
Statut : **PASS LOCAL — REVUE VISUELLE MAINTENEUR REQUISE**

## Critères

- [x] moteur acquisition, scheduler, quota engine, leases, fencing, curseurs, corrections et persistance non réécrits ;
- [x] `current`, `recent_catchup`, `deep_history` et finalisation restent consommés depuis les contrats existants ;
- [x] quota engine dynamique conservé comme source de vérité ;
- [x] aucune fréquence arbitraire demandée à l'administrateur ;
- [x] Sources n'impose plus de JSON pour administrer les quotas ;
- [x] repository, versions et activation atomique des mappings conservés ;
- [x] mapping brut relégué au diagnostic avancé ;
- [x] détail fournisseur structuré en Vue d'ensemble, Configuration, Quotas, Championnats, Synchronisation et Historique & logs ;
- [x] consommation, restant, reset, cadence et prochaine éligibilité affichés lorsque les APIs les fournissent ;
- [x] identifiants externes, strategy, endpoint et structures brutes relégués au mode avancé ;
- [x] Synchronisations reste une vue transverse, avec actions conditionnées par `allowed_actions` ;
- [x] Scheduler supervise les streams persistants, priorités, états, éligibilité, attente, quota, backoff, lease et retry ;
- [x] aucun écran de cron ou fréquence manuelle ajouté ;
- [x] secrets jamais relus ni affichés ;
- [x] preflight conserve `PROVIDER_CALLS=0` et sépare configuration/exécution ;
- [x] liste générale : état quota, restant, reset, cadence automatique, prochaine éligibilité, dernière synchronisation, prochaine action et alertes issus des APIs existantes ;
- [x] absence de données représentée par `Indisponible`, `Non déterminé` ou `Aucune donnée` ;
- [x] credential et connexion API sont deux états distincts ;
- [x] connexion API reste `Non vérifiée` sans véritable test fournisseur autorisé ;
- [x] un preflight réussi ne transforme jamais la connexion API en `OK` ;
- [x] tests ciblés Web : 42/42 PASS ;
- [x] non-régression Web complète : 71/71 PASS ;
- [x] typecheck Web : PASS ;
- [x] lint Web : PASS ;
- [x] build Web : PASS ;
- [x] aucun appel fournisseur réel et aucun crédit consommé.

## Écart accepté dans ce périmètre

Le workflow complet de résolution des ambiguïtés « À associer » ne dispose pas d'une action API de normalisation démontrée dans le périmètre audité. Conformément à l'autorisation UI-R, aucun backend parallèle n'a été inventé. L'interface explique l'état et conserve l'accès avancé au mapping versionné existant. Une file de résolution dédiée nécessite un périmètre mainteneur distinct.

## Interdictions préservées

- aucun appel OCBlackTop/TheSportsDB réel ;
- aucune activation Production Preview ;
- aucun onboarding externe ;
- aucune migration ;
- aucun merge vers `main`.

Validation finale du lot : revue mainteneur explicite requise ; une CI verte ne la remplace pas.
