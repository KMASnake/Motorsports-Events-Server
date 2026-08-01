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

Présent dans la racine du dépôt mais non accepté.

Ajouts :

- CRUD Événements ;
- API publique ;
- API admin ;
- publication.

Régression :

- disparition de la vue calendrier validée.

La prochaine tâche est la rev.1 décrite dans les spécifications Codex.
