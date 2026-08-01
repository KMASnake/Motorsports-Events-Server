# Historique des jalons testés

## v7.1.0-alpha.2

Validé :

- PostgreSQL ;
- API ;
- frontend ;
- Docker Compose ;
- première navigation.

Correctifs découverts :

- healthchecks sur 127.0.0.1 ;
- rafraîchissement de session de démonstration.

## v8.0.0

Socle UI professionnel introduit.

Des erreurs TypeScript ont été corrigées pendant les tests. Cette version a
servi de transition vers MEDS.

## v8.1.0-alpha.2-lot.1-rev.1

Validé :

- fondations MEDS ;
- composants partagés ;
- scripts de validation ;
- trois services healthy.

## v8.1.0-alpha.2-lot.2-rev.2

Validé :

- AppShell ;
- Sidebar ;
- Topbar ;
- PageHeader ;
- navigation centralisée ;
- cleanup/reset Docker ;
- trois services healthy.

Décision validée : console d'administration desktop, sans objectif mobile.

## v8.1.0-alpha.2-lot.3-rev.5

Dernier jalon entièrement validé.

Validé :

- CRUD Championnats ;
- création ;
- modification ;
- suppression ;
- suppression depuis l'interface ;
- protection Fastify contre DELETE vide avec Content-Type JSON ;
- API et frontend healthy.

## v8.1.0-alpha.2-lot.4

Version intermédiaire remplacée par la rev.1 après rétablissement du calendrier.

Ajouts conservés :

- CRUD Événements ;
- API publique ;
- API admin ;
- publication.

Régression corrigée en rev.1 :

- disparition de la vue calendrier validée.

## v8.1.0-alpha.2-lot.4-rev.1

Validé par l'utilisateur le 1er août 2026 sur un déploiement VPS isolé.

Validé :

- PostgreSQL, API et frontend healthy ;
- calendrier Événements affiché par défaut ;
- bascule calendrier/liste et navigation mensuelle ;
- filtres et sélection partagés ;
- création, modification, duplication et suppression ;
- publication et dépublication ;
- API publique et API d'administration ;
- absence de régression sur Championnats ;
- production 2.7.0 laissée intacte.

Référence : `LOT-4-REV-1-VPS-VALIDATION.md`.
