# Checklist d'acceptation — Événements calendrier

## Technique

- [x] `npm run build --workspace @mse/web`
- [x] `npm run build --workspace @mse/api`
- [x] `docker compose up --build`
- [x] PostgreSQL healthy
- [x] API healthy
- [x] Web healthy
- [x] `scripts/test-lot4.cmd`

## Fonctionnel

- [x] Calendrier affiché par défaut
- [x] Bascule Calendrier/Liste
- [x] Liste CRUD conservée
- [x] Création depuis calendrier
- [x] Création depuis liste
- [x] Modification
- [x] Publication/dépublication
- [x] Suppression
- [x] Filtres synchronisés
- [x] Sélection synchronisée
- [x] Panneau de détail complet

## API publique

- [x] Événement publié visible
- [x] Brouillon invisible
- [x] Événement dépublié invisible
- [x] Métadonnées internes absentes
- [x] Championnat inactif masqué

## UI

- [x] Maquette 1440×900 comparée
- [x] Fidélité >= 95 %
- [x] Aucun objectif mobile ajouté
- [x] 1280×720 utilisable
- [x] Aucun scroll horizontal imprévu
- [x] États loading/error/empty présents

Validation utilisateur confirmée le 1er août 2026 depuis Windows, via un
tunnel SSH vers le déploiement VPS isolé. Voir
`LOT-4-REV-1-VPS-VALIDATION.md`.
