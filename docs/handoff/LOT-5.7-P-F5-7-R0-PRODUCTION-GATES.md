# R0 — Contrats post-D1 et gates de Production du Lot 5

Ce contrat de périmètre est formalisé par l'instruction mainteneur R0 du
2026-10-05. L'état courant et toute autorisation effective restent exclusivement
consignés dans [PROGRESS.json](PROGRESS.json). Définir un gate, satisfaire ses
prérequis ou terminer une certification n'autorise jamais son exécution future.
R0 autorise uniquement ce travail de gouvernance et un commit local, sans push.

Il distingue F5 (provider-first, dans 5.7-P-F) du Lot 5 global et F5-7E/F de
5.7-P-E/F. Il conserve la [roadmap Lot 5](../handbook/roadmap/ROADMAP.md),
l'[acceptation Lot 5](LOT-5-PROVIDERS-SYNC-ACCEPTANCE.md) et les
[gates Preview](LOT-5.7-P-GATES.md). Aucun lot F6/F7/F8 n'est créé.

## Périmètre certifié et preuves conservées

La base R0 est `6ef82caaa5228ceee8badd27e0b10aa200bacf82`, tree
`c2b5ffd68c2125d045aafaa2d561a95358f07a11`. Le mainteneur confirme F3/F4,
F5-1 à F5-6, F5-7A/B/C complets et D0/D1 maintainer-validated/complets.
A/B/C sont consignés sur cette déclaration, sans inventer de SHA individuel
ou relancer leur certification. Les objets et la preuve D0/D1 restent intacts.
La CI de cette base (#294 Legacy Python, #563 Node) est SUCCESS selon la preuve
fournie par le mainteneur ; aucune consultation GitHub n'est requise par R0.

La [preuve D1](LOT-5.7-P-F5-7D1-REAL-PROVIDER-CERTIFICATION.md) est immuable :
OCBlackTop / F1 / 2026 / current, une requête, 158 observations, 26 Meetings,
108 Events et 134 ressources canoniques/publiques ; 24 reviews conservées :
18 ambiguous_margin, 5 parent_identity_unresolved, 1 required_identity_unknown,
classées VALID_FAIL_CLOSED_NON_BLOCKING. Le replay 2 crée zéro publication,
en retrouve 134 inchangées et n'ajoute aucune ressource, version, modification
publique ou décision. Audit D1 et clôture gouvernance : PASS.

`REAL_PROVIDER_REQUEST_BUDGET_D1=1/1 CONSUMED`
`DO_NOT_RETRY_D1_PROVIDER_REQUEST=YES`

Le budget historique est définitivement consommé. Une nouvelle acquisition D2
est une opération distincte, sur des cibles explicitement approuvées, avec un
nouveau budget ; elle ne rejoue pas la requête de certification D1.

## Répartition du travail restant

| Travail | Emplacement existant | Preuve attendue avant les gates concernés |
| --- | --- | --- |
| Boucle acquisition, handoff durable, erreurs/reprise, leases et budgets | corrections bornées 5.4/5.5/5.6 et intégration 5.7, séparément autorisées | tests isolés transactionnels, crash/restart, erreurs transitoires/permanentes, kill switches |
| Runs/logs/alertes et suivi acquisition → publication | 5.8 | compteurs cohérents, redaction, rétention, alertes et supervision exploitables |
| Configuration provider et gestion opérationnelle des reviews | 5.9 | administration suffisante, filtres, source/candidat/matches, décisions et scopes incomplets |
| Certification réelle, préprod persistante et consommateurs | F5-7D2/E/F | preuves bornées et acceptation mainteneur pour chaque tranche |
| Acceptation finale | 5.10 | CI SHA exact, sécurité, recette, migration, restore, rollback/forward-fix et décision mainteneur |

D2 exige les parties 5.8/5.9 nécessaires à sa certification, pas la clôture
anticipée de tout le Lot 5. F5 exige ensuite leur acceptation applicable et
5.10 complet. Les dépendances n'autorisent aucune implémentation par R0.
E établit les services staging ; F certifie les consommateurs de ces services.
Les préparatifs de contrat de F peuvent être autorisés séparément sur fixtures,
sans accès staging ni clé réelle, pour éviter une dépendance circulaire E/F.

## F5-7D2

Objectif : certification contrôlée d'opérations provider réelles répétées et
de couverture réelle. Son état et son budget autorisé restent dans PROGRESS ;
R0 ne démarre pas D2 et n'alloue aucun budget.

Entrée obligatoire : chemin périodique complet certifié ; reprise durable
acquisition → handoff ; retry/backoff transitoire et absence de retry permanent
ou fail-closed inapproprié ; quotas/budgets ; leases/fencing/protection doublons ;
crash/restart ; désactivation provider/championnat/stream ; reviews sans boucle
de réacquisition ; administration des reviews suffisante ; observabilité de
l'acquisition à la publication ; autorisation mainteneur explicite et NOUVEAU
budget chiffré. Les cibles, volumes, durée, crédits, stop rules, environnement et
responsable doivent être consignés avant toute requête.

Preuves : cycles répétés, replay identique idempotent, vrais changements
provider quand disponibles ou équivalent contrôlé explicitement approuvé,
mutation canonique seulement si l'état effectif change, révisions et changes,
reviews, quotas, retries/recovery, crash entre acquisition et handoff,
redémarrage, absence de doublon public et de création canonique dangereuse.
La garantie d'ordre/réconciliation multi-provider est prouvée quand incluse.
Chaque championnat annoncé prêt a sa matrice de preuves positive.

Sortie : toutes les preuves applicables au périmètre déclaré passent, toute
substitution est justifiée et approuvée, budgets comptabilisés, P1/P2 du scope
clos et acceptation mainteneur enregistrée au SHA exact. D est complet seulement
après D0/D1/D2 complets et acceptation de la clôture D. D2 n'autorise ni scheduling
préprod persistant, ni Production.

## F5-7E

Objectif : readiness et certification PREPRODUCTION persistante sur données
réelles. Entrée : D2 certifié, prérequis opérationnels applicables certifiés,
autorisation explicite préprod, compatibilité au head de migrations alors
courant, configuration provider/championnat/saison/mapping/policy reproductible,
secrets et budgets propres à la préprod, reviews opérationnelles et monitoring.
Le head de référence R0 est 0041 ; un futur head nécessite sa propre preuve.

Périmètre : DB persistante, inventaire du schéma réel, migration sûre avec backup
préalable et restore vérifié, configuration/secrets persistants, scheduler
initialement désactivé, preflight et validation manuelle bornée, activation
scheduler distincte et explicite, plusieurs cycles, persistance au restart,
crash/recovery, retard acquisition → normalisation → réconciliation → publication,
reviews, API publique et services staging, logs/monitoring/alertes,
backup/restore et stratégie fail-closed de rollback ou correction forward.

Sortie : recette persistante et incident/reprise PASS, intégrité UUID/révisions/
cursors, seuils de lag et alertes convenus, preuves au SHA et schéma exacts,
budgets comptabilisés, aucun P1/P2 du scope et acceptation mainteneur.
Production reste untouched et NOT_AUTHORIZED pendant tout E. Terminer E
n'autorise pas la Production ni l'onboarding Production d'un consommateur.

## F5-7F

Objectif : certification des contrats consommateurs et du staging aval.
Architecture obligatoire : Providers → pipeline canonique Motorsports-Events
→ API publique Motorsports-Events → MyBB / Android / iOS. Aucun consommateur
ne dépend directement d'un schéma provider.

Entrée staging : services E nécessaires certifiés, contrat API canonique
stabilisé, accès et credentials staging dédiés explicitement autorisés.
Une préparation mobile sur fixtures exige une autorisation séparée et un gel
suffisant des contrats sync/auth/version ; elle n'ouvre aucun accès réel.

MyBB exige le code du plugin réel et sa recette, pas une documentation seule :
UUID, authentification courante, bootstrap complet, pagination, checkpoint
local persistant et atomique, /changes, déduplication par révision, expiration
410 avec reprise complète, tombstones, annulations, replanifications,
Europe/Paris/DST, panne API, calendrier last-known-good conservé, retries bornés,
rotation des credentials et compatibilité/versioning. La clé admin est interdite
chez le consommateur. La migration du protocole legacy doit être explicite.

Le contrat backend mobile couvre version stable, bootstrap, sync incrémentale,
checkpoint, expiration/recovery, révisions, tombstones, cache local,
auth/provisioning, révocation, quotas/rate limits et compatibilité/dépréciation.
Il ne considère pas une clé commune embarquée comme un secret sûr.
Comptes utilisateurs, favoris inter-appareils, push, webhooks, résultats,
standings et statistiques peuvent rester différés du calendrier MVP.

Sortie : recette MyBB staging PASS sur le vrai plugin, tests du protocole mobile
backend PASS, preuves au SHA exact, P1/P2 du scope clos et acceptation mainteneur.
F ne certifie pas automatiquement une application Android/iOS non développée
et ne constitue jamais une autorisation de Production.

## Couverture et périmètre annoncé

TARGET_MVP_CHAMPIONSHIPS : F1, Formula E, MotoGP, Moto2, Moto3, WRC, WSBK, WSSP.
CERTIFIED_REAL_CHAMPIONSHIPS à la base R0 : F1 uniquement, dans le périmètre D1.
Une preuve réelle F1 n'est pas à elle seule une qualification Production-ready.
Un seed, catalogue adaptateur ou fixture ne certifie aucune acquisition réelle.

Un championnat est annoncé Production-ready uniquement avec preuves positives
provider/configuration, saison/mapping, acquisition, normalisation, publication
et contrat consommateur. Les matrices distinguent réel, synthétique et absence
de preuve. Toute réduction de périmètre requiert une décision explicite : un
pilote F1 seul ne peut pas être présenté comme le MVP complet huit séries.

## Sorties F5-7 et F5

F5-7 exige A/B/C et D0/D1/D2/E/F complets, aucun P1/P2 non résolu de son scope,
CI requises vertes au SHA exact de certification, budgets réels comptabilisés,
aucune exécution provider ou activation d'environnement non autorisée et
acceptation mainteneur consignée. Sa clôture n'autorise pas la Production.

F5 exige F5-1 à F5-7 complets, 5.8 supervision et 5.9 administration acceptés
sur leur périmètre applicable, 5.10 acceptation finale complète, configuration
et gestion des reviews suffisantes pour le MVP déclaré, contrat consommateur
certifié, backup/restore/migration/rollback ou forward-fix certifiés,
sécurité/monitoring acceptés, CI finales au SHA exact et acceptation finale
mainteneur. F5 ne remplace pas les autres critères applicables du gate 5.7-P-F
ou du Lot 5 global ; leurs clôtures nécessitent également leur décision propre.

## Gates explicites d'autorisation

Tous ces points sont des conditions futures, sans autorisation effective R0.

| Point | Première possibilité, sous décision mainteneur explicite |
| --- | --- |
| Requêtes provider répétées | D2 après prérequis certifiés et NOUVEAU budget |
| Scheduler préprod persistant | E après certification opérationnelle isolée PASS et autorisation spécifique |
| MyBB staging | F avec credentials staging dédiés |
| Développement mobile | F après gel suffisant du contrat backend sync/auth/version |
| DB Production | uniquement après acceptation finale/go-live et autorisation bornée |
| Configuration provider Production | étape distincte après validation DB/schéma/secrets |
| Scheduler Production | étape distincte après one-shot/smoke Production autorisé et PASS |
| Cutover MyBB Production | après staging MyBB et smoke API Production PASS |
| Consommation mobile Production | après acceptation provisioning/compatibilité du client concerné |
| PRODUCTION_STATE=AUTHORIZED | décision mainteneur explicite après tous les gates finaux applicables |

Une autorisation DB ne vaut pas autorisation provider ou scheduler. Le one-shot
Production exige lui-même cible, budget, stop rules et autorisation propres.
La décision précise chaque étape, son scope, les contrôles et l'arrêt possible.
Une CI verte seule ne peut jamais autoriser Production, merge ou onboarding.

## Migration, rollback et historique documentaire

0041 peut refuser volontairement son DOWN après historique revisionné.
Le rollback ne suppose donc aucun downgrade arbitraire : rollback applicatif
avec schéma compatible, migration corrective forward, ou restore d'un backup
pré-changement vérifié seulement si explicitement sûr et autorisé.
Supprimer destructivement l'historique des décisions de normalisation ou de
réconciliation pour permettre un rollback est interdit.

L'audit post-D1 est PASS, sans P1. P2-01 boucle/handoff, P2-02 erreurs/reprise,
P2-03 reviews, P2-04 MyBB, P2-05 restore/monitoring et P2-06 couverture restent
ouverts pour readiness. R0 résout P3-01 par définition de ces contrats, sans
prétendre résoudre un P2 fonctionnel ou refaire l'audit D1.
P3-02 références historiques/runbooks et P3-03 documentation Android restent
ouverts. Les documents A/B/C, anciennes clôtures et runbook baseline 0031 restent
inchangés, historiques pour leur état/schéma ; ils ne définissent ni l'état
actuel ni une autorisation. Les règles permanentes du Handbook/ADR et les
contrats normatifs applicables restent en vigueur. PROGRESS prévaut pour l'état.

## Exigences structurées contrôlées

Cette liste est normative pour le périmètre R0 et vérifiée par le validateur.
Elle définit les critères ; elle ne porte aucune autorisation actuelle.

<!-- R0-PRODUCTION-GATES
{
  "schema": "post-d1-r0-v1",
  "definition_only": true,
  "d1_request_budget": "1/1 CONSUMED",
  "do_not_retry_d1_provider_request": true,
  "lot_5_dependencies": [
    "5.8",
    "5.9",
    "5.10"
  ],
  "requirements": {
    "d2_entry": [
      "periodic_acquisition_path_certified",
      "durable_acquisition_handoff_recovery",
      "transient_retry_backoff",
      "permanent_fail_closed_no_retry",
      "quota_and_request_budget_enforcement",
      "leases_fencing_duplicate_protection",
      "crash_restart_certified",
      "disabled_provider_championship_stream",
      "review_without_reacquisition_loop",
      "operational_review_handling",
      "acquisition_publication_observability",
      "explicit_maintainer_authorization",
      "new_separate_provider_budget"
    ],
    "d2_evidence": [
      "bounded_targets_and_cycles",
      "identical_replay_idempotence",
      "genuine_changes_or_approved_equivalent",
      "effective_changes_only",
      "publication_revisions_changes",
      "review_queue",
      "quotas",
      "retry_recovery",
      "acquisition_handoff_crash",
      "restart",
      "no_duplicate_publication",
      "no_unsafe_canonical_creation",
      "multi_provider_order_if_in_scope",
      "positive_championship_evidence_matrix"
    ],
    "e_entry": [
      "d2_certified",
      "operational_prerequisites_certified",
      "explicit_persistent_preprod_authorization",
      "then_current_schema_compatible",
      "reproducible_provider_season_mapping_policy",
      "preprod_secrets_and_budgets",
      "operational_reviews",
      "monitoring_available"
    ],
    "e_evidence": [
      "persistent_database",
      "actual_schema_safe_migration",
      "backup_before_migration",
      "restore_verification",
      "persistent_configuration_secrets",
      "scheduler_initially_disabled",
      "bounded_manual_preflight",
      "explicit_scheduler_activation",
      "multiple_scheduled_cycles",
      "restart_persistence",
      "crash_recovery",
      "pipeline_lag",
      "review_queue",
      "public_api_staging_consumers",
      "monitoring_logs_alerts",
      "backup_restore",
      "fail_closed_rollback_forward_fix",
      "production_untouched"
    ],
    "f_mybb": [
      "real_plugin_code",
      "canonical_uuid",
      "current_authentication",
      "full_bootstrap",
      "pagination",
      "persistent_checkpoint",
      "changes_sync",
      "revision_deduplication",
      "cursor_410_full_recovery",
      "tombstones",
      "cancellations",
      "rescheduling",
      "europe_paris_dst",
      "outage",
      "last_known_good",
      "bounded_retries",
      "credential_rotation",
      "compatibility_versioning"
    ],
    "f_mobile": [
      "stable_api_version",
      "bootstrap",
      "incremental_sync",
      "checkpoint_semantics",
      "cursor_expiration_recovery",
      "revisions",
      "tombstones",
      "local_cache",
      "auth_provisioning",
      "revocation",
      "quotas_rate_limits",
      "compatibility_deprecation"
    ],
    "f57_exit": [
      "a_b_c_complete",
      "d0_complete",
      "d1_complete",
      "d2_complete",
      "e_complete",
      "f_complete",
      "no_open_p1_p2_in_scope",
      "required_ci_exact_sha",
      "all_budgets_accounted",
      "no_unauthorized_provider_execution",
      "no_unauthorized_environment_activation",
      "recorded_maintainer_acceptance"
    ],
    "f5_exit": [
      "f5_1_to_f5_7_complete",
      "applicable_5_8_accepted",
      "applicable_5_9_accepted",
      "5_10_final_acceptance_complete",
      "declared_mvp_configuration_reviews",
      "consumer_contract_certified",
      "backup_restore_migration_rollback_forward_fix",
      "security_monitoring_accepted",
      "final_ci_exact_sha",
      "final_maintainer_acceptance"
    ]
  },
  "authorization_points": {
    "FIRST_REPEATED_REAL_PROVIDER_AUTHORIZATION": "F5-7D2: separate maintainer authorization and NEW budget",
    "FIRST_PERSISTENT_PREPROD_SCHEDULER_AUTHORIZATION": "F5-7E: isolated operational certification PASS and explicit maintainer authorization",
    "FIRST_MYBB_STAGING_AUTHORIZATION": "F5-7F: explicit maintainer authorization and dedicated staging credentials",
    "FIRST_MOBILE_DEVELOPMENT_AUTHORIZATION": "F5-7F: explicit maintainer authorization after backend sync/auth/version contract freeze",
    "FIRST_PRODUCTION_DB_AUTHORIZATION": "Final acceptance/go-live gate and explicit bounded maintainer authorization",
    "FIRST_PRODUCTION_PROVIDER_CONFIGURATION_AUTHORIZATION": "Separate bounded step after DB/schema/secrets validation",
    "FIRST_PRODUCTION_SCHEDULER_AUTHORIZATION": "Separate bounded step after authorized Production one-shot/smoke PASS",
    "FIRST_MYBB_PRODUCTION_CUTOVER_AUTHORIZATION": "Explicit cutover after MyBB staging and Production API smoke PASS",
    "FIRST_MOBILE_PRODUCTION_AUTHORIZATION": "Explicit authorization after concerned mobile provisioning/compatibility acceptance",
    "PRODUCTION_AUTHORIZATION_GATE": "Explicit maintainer decision after all applicable final acceptance gates; CI alone never authorizes"
  },
  "production_untouched_in_e": true,
  "completion_never_authorizes_execution": true,
  "rollback_strategies": [
    "compatible_application_rollback",
    "forward_corrective_migration",
    "explicitly_safe_verified_backup_restore"
  ],
  "destructive_decision_history_deletion_forbidden": true
}
R0-PRODUCTION-GATES -->
