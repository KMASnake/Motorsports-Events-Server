# Lot 4 — Gestion des événements

Version `8.1.0-alpha.2-lot.4`.

## Périmètre
- CRUD complet des événements dans l’administration ;
- rattachement obligatoire à un championnat ;
- circuit facultatif ;
- dates de début et de fin, fuseau horaire, statut et publication ;
- origine `manual/provider/mixed` conservée comme métadonnée d’administration ;
- API publique distincte, sans provider ni origine ;
- filtres et compteur de publication ;
- validation automatisée `scripts/test-lot4.cmd`.

## Contrat API
- `GET /api/v1/events` : événements publiés, hors brouillons, appartenant à un championnat actif ;
- `GET /api/v1/events/:id` : détail public ;
- `/api/v1/admin/events` : référentiel d’administration et CRUD.

Le nom du provider et l’identifiant externe ne sont jamais exposés dans l’API publique.
