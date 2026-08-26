# Lot 5.7-P-F1-UI — administration des sources

Statut : implémenté après corrections d’audit, en attente de réaudit mainteneur.

## Responsabilités

- **Sources** administre les instances fournisseur, credentials, associations championnat, configurations source, quotas/cadence, versions de mapping et le preflight sans crédit.
- **Synchronisations** conserve l’exploitation et la supervision des acquisitions sur le modèle backend canonique.
- **Tâches planifiées** reste dédiée au scheduler existant ; aucun second scheduler n’est introduit.

Chaque association fournisseur/championnat est sélectionnée explicitement. La sélection est préservée au rechargement lorsqu’elle existe encore et réinitialisée lors d’un changement de fournisseur ; édition source, mapping et preflight ciblent exclusivement cette association.

## Contrats de sécurité

Le remplacement de `api_key` réutilise `ProviderConfigurationService.replaceSecret()` et `ProviderSecretCipher`. Le champ est de type password, n’est jamais prérempli, et seules les métadonnées de présence sont retournées. Les configurations provider/source et les audits appliquent la redaction existante.

Les mappings restent immuables : toute édition crée puis active une nouvelle version via `PostgresNormalizationMappingRepository`; création, activation et écriture de l’audit admin partagent une transaction unique. Un échec d’audit annule l’ensemble et l’historique est conservé par la migration 0030 existante.

L’action « Vérifier la configuration » appelle exclusivement `BoundedProviderOneShotRunner.preflight()`. Elle ne lance ni acquisition, ni discovery, ni publication, ne crée aucune traversal et n’avance aucun cursor. Son contrat expose `PROVIDER_CALLS=0`.

## Frontière d’activation

`CONFIGURED != EXECUTION_AUTHORIZED`. Sources crée les nouveaux providers avec `enabled=false` et `discovery_enabled=false`, n’expose aucune mutation de ces champs et ne propose aucune transition `sync_state`. Les états opérationnels existants sont informatifs seulement. Leur changement reste hors de ce sous-lot.

Les éditeurs JSON quota/mapping refusent localement un document invalide et affichent une erreur contrôlée, sans exception React.

## Hors périmètre

Aucun endpoint ou bouton d’exécution réelle n’est ajouté. Aucun appel fournisseur réel, migration, déploiement VPS, activation Production Preview, onboarding externe ou merge vers `main` n’est autorisé par ce sous-lot.
