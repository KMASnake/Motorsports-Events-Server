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
- aucune ingestion complète d'événements fournisseur et aucun moteur de quota 5.5.

## Recette automatisée

```sh
sudo env \
  LOT54_PROJECT=mse-lot54-scheduler-vps \
  LOT54_POSTGRES_PORT=55474 \
  ./scripts/test-lot54-scheduler.sh
```

Résultat local : `Tests Lot 5.4 scheduler : OK`.

La recette vérifie PostgreSQL réel, migrations aller/retour, fenêtre glissante,
pondération, concurrence, leases et heartbeat, fencing, crash recovery,
atomicité et rejeu, commandes administrateur, rollover annuel, suspension sur
erreur d'authentification, découverte périodique et absence d'ingestion métier.

## Arrêt obligatoire

Le Lot 5.4 n'est pas encore validé par le mainteneur. Le Lot 5.5 et les lots
suivants restent hors périmètre et ne doivent pas être commencés.
