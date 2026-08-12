# Validation du Lot 5.4 — scheduler, curseurs et leases

État au 12 août 2026 : implémentation terminée et validation locale réussie ;
validation mainteneur requise avant tout Lot 5.5.

## Périmètre livré

- flux PostgreSQL persistants `current` et `historical` ;
- classes logiques `current`, `recent_catchup` et `deep_history` pondérées 3/2/1 ;
- fenêtre courante glissante de sept jours et reprise au changement d'année ;
- pool global de quatre workers et limite de concurrence par fournisseur ;
- leases de 120 secondes, heartbeat, génération de fencing et reprise après crash ;
- progression atomique résultat/curseur/exécution et refus des workers périmés ;
- commandes auditées activation, pause, reprise, reset ciblé et sync-now ;
- sélection persistante des découvertes arrivées à échéance ;
- runtime périodique léger (polling 15 s, configurable entre 10 et 30 s),
  utilisant exclusivement le scheduler PostgreSQL et arrêté avec Fastify ;
- aucune ingestion complète d'événements fournisseur et aucun moteur de quota 5.5.

## Corrections après audit

La migration additive `0012_scheduler_audit_fixes` mémorise durablement
`sync_state_before_championship_disable`. La réactivation restaure exactement
l'état antérieur : `active` rend les streams non loués éligibles et booste le
flux current ; `paused`, `inactive`, `error` et `suspended` restent dans leur
état sans activation arbitraire. Un lease déjà actif termine normalement et
son curseur n'est pas réinitialisé.

`fail()` applique désormais la même validation que `commit()` : propriétaire,
génération et expiration. Un worker périmé ne modifie ni stream, ni run, ni
compteur, ni fournisseur. Les leases discovery comptent dans le pool global et
la concurrence fournisseur dans les deux sens. Ils possèdent heartbeat,
expiration, génération et garde de fencing avant les écritures périodiques.

Le runtime periodic discovery appelle `ProviderDiscoveryService.discover()`
avec l'origine `periodic`. La garde quota conservatrice 5.3 reste inchangée ;
un résultat `deferred_quota` libère normalement le lease. Deux instances
peuvent poller : le verrou transactionnel sur la configuration et les lignes
`FOR UPDATE SKIP LOCKED` garantissent une acquisition unique. Aucun cron ni
scheduler mémoire parallèle n'est introduit.

## Recette automatisée

```sh
sudo env \
  LOT54_PROJECT=mse-lot54-scheduler-vps \
  LOT54_POSTGRES_PORT=55474 \
  ./scripts/test-lot54-scheduler.sh
```

Résultat local : `Tests Lot 5.4 scheduler : OK`.

La recette vérifie PostgreSQL réel, migrations `0011/0012` aller/retour,
restauration active/inactive/paused, stale fail, fenêtre glissante,
round-robin PostgreSQL réel 3/2/1 et redistribution, plafonds globaux et par
fournisseur incluant discovery, leases et heartbeats, fencing, crash recovery,
atomicité et rejeu, commandes administrateur, rollover annuel, suspension sur
erreur d'authentification, découverte périodique et absence d'ingestion métier.

Crédits fournisseur consommés par cette recette : **0** (adaptateurs et sinks
synthétiques ; aucun appel OCBlackTop ou TheSportsDB).

## Arrêt obligatoire

Le Lot 5.4 n'est pas encore validé par le mainteneur. Le Lot 5.5 et les lots
suivants restent hors périmètre et ne doivent pas être commencés.
