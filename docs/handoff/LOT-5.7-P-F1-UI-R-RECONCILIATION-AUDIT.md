# Lot 5.7-P-F1-UI-R — audit de réconciliation conception / implémentation

Date : 2026-08-26
Commit de départ : `e1da9b894426b9af263f75de72e8519059e92871`
Périmètre : administration Sources, Synchronisations et Scheduler, sans appel fournisseur.

## Hiérarchie appliquée

L'audit applique les amendements 5.4 et 5.5 avant le concept Lot 5 initial : fenêtre `current` glissante, classes `recent_catchup` et `deep_history`, pondération 3/2/1, marge de sécurité 5 %, réserve `current` 20 %, quota inconnu prudent et cadence calculée. Le contrat UI 5.6 précise ensuite la représentation opérateur. L'implémentation existante n'est jamais prise comme spécification.

## Matrice de réconciliation

| EXIGENCE | SOURCE CANONIQUE | IMPLÉMENTATION | VERDICT | ACTION |
|---|---|---|---|---|
| Scheduler persistant, leases, fencing, reprise et équité | `LOT-5.4-SCHEDULER-CONCEPT.md` §§2, 5, 7–10, 15 | `schedulerService.ts`, migrations et recettes existantes | CONFORME | KEEP : ne pas modifier le moteur. |
| `current` glissant, `recent_catchup`, `deep_history` | `LOT-5.4-SCHEDULER-CONCEPT.md` §§2–4 ; `LOT-5.6-UI-CONTRACT.md` §§3, 5 | États persistés et exposés par `AcquisitionAdminService.overview()` | CONFORME_MAIS_MAL_EXPOSE | CHANGE UI : libellés métier explicites dans les vues Synchronisations/Scheduler. |
| Finalisation et last-known-good | `LOT-5.6-UI-CONTRACT.md` §§4, 7 | Bloc finalisation, anomalies et source durable exposés par l'overview acquisition | CONFORME | KEEP backend ; conserver la vue transverse. |
| Quota gate dynamique, pacing, Retry-After et backoffs | `LOT-5.5-QUOTA-CADENCE-CONCEPT.md` §§1–10, 13 | `QuotaCadenceService` et `/providers/:id/quota-diagnostics` | CONFORME_MAIS_MAL_EXPOSE | CHANGE UI : afficher résumé, reset, cadence/éligibilité et raison d'attente. |
| Marge 5 % et réserve `current` 20 % | `LOT-5.5-QUOTA-CADENCE-CONCEPT.md` §§6–7 | Valeurs par défaut API/UI correctes | CONFORME | KEEP les valeurs amendées ; ne pas restaurer 30 %. |
| L'administrateur configure des limites, pas une fréquence | `LOT-5-PROVIDERS-SYNC-CONCEPT.md` « Quotas et cadence » ; `LOT-5.5...CONCEPT.md` §8 | Aucun champ de fréquence ; politique quota disponible | CONFORME | KEEP ; expliquer « cadence automatique ». |
| Quota administré sans JSON obligatoire | instruction UI-R §§5, 7.4 ; `LOT-5.5...ACCEPTANCE.md` « Diagnostic admin » | `SourcesPage` impose un `textarea` JSON | DERIVE_UI | CHANGE : formulaire métier typé ; détails bruts uniquement en avancé. |
| Mapping versionné et immuable conservé | concept Lot 5 « Normalisation et mappings » ; preuve `LOT-5.7-P-F1-UI-SOURCES-ADMIN.md` | Repository/versioning et création atomique conformes | CONFORME | KEEP backend et historique. |
| Mapping JSON absent du parcours normal | instruction UI-R §6 | `MappingForm` impose l'édition du document JSON | DERIVE_UI | HIDE : synthèse en mode normal, éditeur réservé au diagnostic avancé. |
| Workflow métier « À associer » | `LOT-5.3-DISCOVERY-CONCEPT.md` §§3–7 ; concept Lot 5 « Normalisation et mappings » | Entités de découverte et association existent, mais aucune UI de résolution des mappings de normalisation n'est exposée ici | PARTIEL | DOCUMENT : ne pas inventer de moteur parallèle ; conserver comme écart futur borné. |
| Détail fournisseur : vue d'ensemble/configuration/quotas/championnats/synchronisation/historique | concept Lot 5 « Administration et maquettes » ; instruction UI-R §7 | Informations dispersées en panneaux successifs, sans navigation secondaire ni historique | PARTIEL | CHANGE : onglets/sections cohérents alimentés par APIs existantes. |
| Secret jamais relu ni exposé | concept Lot 5 « Secrets fournisseurs » ; Handbook sécurité | Champ password vide et DTO de présence uniquement | CONFORME | KEEP chiffrement et remplacement explicite. |
| Preflight strictement zéro crédit et distinction configuration/exécution | instruction UI-R §11 ; `LOT-5.7-P-F1-UI-SOURCES-ADMIN.md` | `BoundedProviderOneShotRunner.preflight()` et présentation séparée | CONFORME | KEEP ; améliorer la checklist métier et conserver `PROVIDER_CALLS=0`. |
| Sources ne déclenche aucune exécution | gouvernance `PROGRESS.json` ; `LOT-5.7-P-F1-UI-SOURCES-ADMIN.md` | Actions interdites absentes, nouveaux providers désactivés | CONFORME | KEEP la frontière de sécurité. |
| Synchronisations transverse et actions soumises aux protections | `LOT-5.6-UI-CONTRACT.md` §§2–13 ; instruction UI-R §8 | `ProviderAcquisitionPage` consomme overview/anomalies et conditionne les actions via `allowed_actions` | CONFORME_MAIS_MAL_EXPOSE | KEEP structure ; renforcer quota/éligibilité et terminologie des classes. |
| Scheduler présenté comme supervision dynamique, pas cron | `LOT-5.4-SCHEDULER-CONCEPT.md` §§5, 14–16 ; instruction UI-R §9 | Route `/tasks` rend le placeholder générique | MANQUANT | CHANGE UI : page de supervision agrégée depuis providers, associations, streams, runs et diagnostics existants. |
| Historique synthétique : statut, durée, compteurs, requêtes, erreurs | concept Lot 5 « Historique et logs » ; `LOT-5.6-UI-CONTRACT.md` §7 | `sync_runs` est exposé par API mais absent du détail Sources | CONFORME_MAIS_MAL_EXPOSE | MOVE l'exposition vers l'onglet « Historique & logs » sans déplacer la donnée. |
| Mode normal métier, mode avancé diagnostic | instruction UI-R §10 ; Handbook « Administration orientée métier » | IDs, strategy, endpoint et JSON dominent la fiche | DERIVE_UI | HIDE détails techniques derrière `<details>` ; présenter états/libellés métier en premier. |
| Langage visuel MEDS validé | Handbook « Graphismes » ; `validated-mockups/synchronizations-validated.png` | Design system, panels, tables et chips existants réutilisés | CONFORME | KEEP composants/CSS existants et étendre sans seconde identité visuelle. |
| Aucun appel fournisseur pendant UI/tests | gouvernance `PROGRESS.json` ; instruction UI-R §12 | Clients ciblent uniquement routes admin de lecture/configuration/preflight | CONFORME | KEEP ; tests avec mocks et contrôle statique des actions. |

## Décisions KEEP / MOVE / HIDE / CHANGE

- **KEEP** : acquisition, scheduler, streams, quotas/cadence, leases/fencing, corrections, source storage, secrets, mapping repository/versioning et preflight.
- **MOVE** : les runs existants vers une présentation « Historique & logs » dans le détail fournisseur ; aucune donnée ni responsabilité backend n'est déplacée.
- **HIDE** : JSON mapping, strategy, endpoint template, identifiants externes et structures quota derrière un mode avancé facultatif.
- **CHANGE** : formulaire quota métier, navigation secondaire du fournisseur, synthèses synchronisation/historique et page Scheduler de supervision dynamique.

## Corrections backend justifiées

Aucune. Les surfaces nécessaires existent déjà : diagnostics quota, associations, streams, runs et overview acquisition. Une agrégation côté client suffit et évite de déformer le moteur validé.

## Écart explicitement non inventé

La résolution métier complète « À associer » pour les ambiguïtés de normalisation n'est pas démontrée comme action API disponible dans ce périmètre. L'éditeur avancé conserve l'accès au document versionné existant, mais aucune API parallèle ni nouvelle sémantique de mapping ne sera créée. Cet écart reste à traiter dans un lot explicitement autorisé si le mainteneur exige une file de résolution dédiée.

## Absence de conflit de réconciliation

Aucun `RECONCILIATION_CONFLICT` bloquant n'a été trouvé. Les changements demandés peuvent rester UI et clients API, sans migration ni modification du moteur fournisseur.

## Audit mainteneur — corrections fermées

Baseline de correction : `7cfab5e061a0b79126f61a969a2cb557af17ad0f`.

| FINDING | CORRECTION | PREUVE | STATUT |
|---|---|---|---|
| Liste générale des fournisseurs trop pauvre | Agrégation frontend parallèle et bornée des diagnostics quota, associations, streams et runs ; affichage quota/restant/reset/cadence/éligibilité/dernière synchronisation/prochaine action/alertes avec états neutres explicites | `providerListSummary()` et tests Sources | FERMÉ |
| `Connexion = Credential configuré` | Credential et connexion API deviennent deux lignes distinctes ; connexion reste `Non vérifiée`, y compris après preflight zéro crédit | Vue d'ensemble Sources et tests de non-assimilation | FERMÉ |

Aucun endpoint, service backend ou appel fournisseur n'a été ajouté pour ces corrections.
