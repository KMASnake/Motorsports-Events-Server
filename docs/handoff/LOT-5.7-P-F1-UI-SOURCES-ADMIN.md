# Lot 5.7-P-F1-UI — administration des sources

Statut : **PASS — validé par le mainteneur le 2026-08-27**.

SHA validé et déployé en préproduction :
`298356fdcba4375582ea2d36588afb16815c55dd`.

## Responsabilités

- **Sources** administre les instances fournisseur, credentials, associations championnat, configurations source, quotas/cadence, versions de mapping et le preflight sans crédit.
- **Synchronisations** conserve l’exploitation et la supervision des acquisitions sur le modèle backend canonique.
- **Tâches planifiées** reste dédiée au scheduler existant ; aucun second scheduler n’est introduit.

Chaque association fournisseur/championnat est sélectionnée explicitement. La sélection est préservée au rechargement lorsqu’elle existe encore et réinitialisée lors d’un changement de fournisseur ; édition source, mapping et preflight ciblent exclusivement cette association.

## Contrats de sécurité

Le remplacement de `api_key` réutilise `ProviderConfigurationService.replaceSecret()` et `ProviderSecretCipher`. Le champ est de type password, n’est jamais prérempli, et seules les métadonnées de présence sont retournées. Les configurations provider/source et les audits appliquent la redaction existante.

Les mappings restent immuables : toute édition crée puis active une nouvelle version via `PostgresNormalizationMappingRepository`; création, activation et écriture de l’audit admin partagent une transaction unique. Un échec d’audit annule l’ensemble et l’historique est conservé par la migration 0030 existante.

L’action « Vérifier la configuration » appelle exclusivement `BoundedProviderOneShotRunner.preflight()`. Elle ne lance ni acquisition, ni discovery, ni publication, ne crée aucune traversal et n’avance aucun cursor. Son contrat expose `PROVIDER_CALLS=0`.

Le preflight canonique distingue désormais deux dimensions :

- `configuration_ready` valide adapter, configuration provider/source, credential présent, stream current, mapping effectif et quota/cadence sans exiger une activation opérationnelle ;
- `execution_ready` ajoute les exigences strictes `provider.enabled`, état provider actif, association active et stream exécutable.

Une source volontairement désactivée ou en pause peut donc être techniquement prête tout en exposant des `execution_blockers`. `BoundedProviderOneShotRunner.run()` exige toujours `execution_ready=true` et refuse sinon avec `execution_not_authorized`, avant lecture du secret, autorisation quota, lease, traversal ou requête fournisseur.

## Frontière d’activation

`CONFIGURED != EXECUTION_AUTHORIZED`. Sources crée les nouveaux providers avec `enabled=false` et `discovery_enabled=false`, n’expose aucune mutation de ces champs et ne propose aucune transition `sync_state`. Les états opérationnels existants sont informatifs seulement. Leur changement reste hors de ce sous-lot.

Les éditeurs JSON quota/mapping refusent localement un document invalide et affichent une erreur contrôlée, sans exception React.

Une édition purement configurationnelle conserve également l’état opérationnel
existant. La preuve préproduction a confirmé qu’un provider
`enabled=true`, `state=paused`, `discovery_enabled=false` reste `paused` après
édition de sa configuration. Seul le chemin opérationnel explicite peut
demander une transition d’état.

## Validation mainteneur et préproduction

Le réaudit mainteneur est **PASS** et le MVP Sources administration est validé.
Sur le SHA certifié, le preflight borné a retourné :

- `status=preflight_ok` ;
- `configuration_ready=true` et aucun `configuration_blocker` ;
- `execution_ready=false` avec `execution_blockers=["provider_paused"]` ;
- `provider_enabled=true` et `provider_state=paused` ;
- budget 1, aucune requête émise, budget restant 1 ;
- `PROVIDER_CALLS=0`.

La sentinelle quota est restée à trois charges avec `last_charge=3`. Aucun
traversal n’a été créé. Le worker est resté arrêté. API, Web, PostgreSQL et
Prometheus sont restés healthy, et `/health` exposait le SHA certifié.

Les validations déjà auditées restent acquises : API ciblée 27/27, Web ciblé
38/38, intégration HTTP/service/AES-GCM/PostgreSQL PASS, bounded runner
PostgreSQL avec transport mock PASS, typecheck et lint API/Web PASS,
`validate-repository.sh` 54 PASS / 18 SKIPPED et `git diff --check` PASS.

Aucun appel fournisseur réel ni crédit fournisseur n’a été consommé pendant
la validation.

## Hors périmètre

Aucun endpoint ou bouton d’exécution réelle n’est ajouté. Aucun appel fournisseur réel, migration, déploiement VPS, activation Production Preview, onboarding externe ou merge vers `main` n’est autorisé par ce sous-lot.

Cette validation ne clôt pas Gate F : sa validation fournisseur réelle et ses
autres preuves externes obligatoires restent requises. Aucune sous-phase
suivante n’est autorisée automatiquement.
