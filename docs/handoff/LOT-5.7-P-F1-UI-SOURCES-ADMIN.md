# Lot 5.7-P-F1-UI — administration des sources

Statut : implémenté localement, en attente d’audit mainteneur.

## Responsabilités

- **Sources** administre les instances fournisseur, credentials, associations championnat, configurations source, quotas/cadence, versions de mapping et le preflight sans crédit.
- **Synchronisations** conserve l’exploitation et la supervision des acquisitions sur le modèle backend canonique.
- **Tâches planifiées** reste dédiée au scheduler existant ; aucun second scheduler n’est introduit.

## Contrats de sécurité

Le remplacement de `api_key` réutilise `ProviderConfigurationService.replaceSecret()` et `ProviderSecretCipher`. Le champ est de type password, n’est jamais prérempli, et seules les métadonnées de présence sont retournées. Les configurations provider/source et les audits appliquent la redaction existante.

Les mappings restent immuables : toute édition crée puis active atomiquement une nouvelle version via `PostgresNormalizationMappingRepository`; l’historique est conservé par la migration 0030 existante.

L’action « Vérifier la configuration » appelle exclusivement `BoundedProviderOneShotRunner.preflight()`. Elle ne lance ni acquisition, ni discovery, ni publication, ne crée aucune traversal et n’avance aucun cursor. Son contrat expose `PROVIDER_CALLS=0`.

## Hors périmètre

Aucun endpoint ou bouton d’exécution réelle n’est ajouté. Aucun appel fournisseur réel, migration, déploiement VPS, activation Production Preview, onboarding externe ou merge vers `main` n’est autorisé par ce sous-lot.
