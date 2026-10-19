# Lot 3 — Gestion des championnats

Version : `8.1.0-alpha.2-lot.4`

## Fonctionnalités livrées

- CRUD complet des championnats ;
- catégorie facultative, jamais créée implicitement ;
- saison et statut d'activation ;
- synchronisation facultative ;
- provider et identifiant externe conservés comme métadonnées d'administration ;
- protection contre la suppression lorsqu'un événement est lié ;
- recherche et filtre par statut ;
- formulaire MEDS de création et de modification ;
- test automatique création → modification → suppression.

## Contraintes préservées

- aucune dépendance à un provider pour créer un championnat ;
- aucun nom de provider injecté dans les événements ;
- interface d'administration ciblée desktop, résolution minimale 1280×720.

## Validation

```cmd
scripts\reset-dev.cmd
scripts\test-lot3.cmd
```
