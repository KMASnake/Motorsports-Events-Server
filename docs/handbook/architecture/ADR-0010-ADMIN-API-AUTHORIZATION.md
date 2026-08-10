# ADR-0010 — Authentification de l'API d'administration

## Décision

Toutes les routes sous `/api/v1/admin/` exigent un jeton Bearer signé par
HMAC-SHA256, non expiré et portant le rôle `admin`. Le contrôle est enregistré
globalement avant les routeurs administratifs.

Les mutations historiques de `/api/v1/championships` sont également protégées
sans renommer la route publique de lecture, afin de préserver le contrat.

Une absence de jeton, une signature invalide ou une expiration retourne `401`.
Un jeton authentique sans rôle administrateur retourne `403`. Les routes
publiques restent accessibles sans authentification.

## Secrets et client Web

Le secret de signature reste exclusivement dans `ADMIN_AUTH_SECRET` côté API
et contient au moins 32 caractères. Il n'est jamais transmis au navigateur ni
commité. Le client Web conserve temporairement son jeton dans `sessionStorage`;
aucun jeton n'est intégré au bundle statique.

## Validation

Chaque famille de routes administratives couvre absence, invalidité,
expiration, rôle insuffisant et succès administrateur. La recette utilise des
jetons et données synthétiques dédiés puis les supprime.
