# Checklist d'acceptation — Événements calendrier

## Technique

- [ ] `npm run build --workspace @mse/web`
- [ ] `npm run build --workspace @mse/api`
- [ ] `docker compose up --build`
- [ ] PostgreSQL healthy
- [ ] API healthy
- [ ] Web healthy
- [ ] `scripts/test-lot4.cmd`

## Fonctionnel

- [ ] Calendrier affiché par défaut
- [ ] Bascule Calendrier/Liste
- [ ] Liste CRUD conservée
- [ ] Création depuis calendrier
- [ ] Création depuis liste
- [ ] Modification
- [ ] Publication/dépublication
- [ ] Suppression
- [ ] Filtres synchronisés
- [ ] Sélection synchronisée
- [ ] Panneau de détail complet

## API publique

- [ ] Événement publié visible
- [ ] Brouillon invisible
- [ ] Événement dépublié invisible
- [ ] Métadonnées internes absentes
- [ ] Championnat inactif masqué

## UI

- [ ] Maquette 1440×900 comparée
- [ ] Fidélité >= 95 %
- [ ] Aucun objectif mobile ajouté
- [ ] 1280×720 utilisable
- [ ] Aucun scroll horizontal imprévu
- [ ] États loading/error/empty présents
