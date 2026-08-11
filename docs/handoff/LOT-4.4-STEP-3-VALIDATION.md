# Lot 4.4 — Validation de l'étape 3

Date : 2026-08-11

Statut : `maintainer-validated`

Validation mainteneur : confirmée le 2026-08-11 après réussite de la recette
Chromium sur le VPS.

## Périmètre

- page React `/login` hors du shell d'administration ;
- restauration initiale de session sans affichage transitoire de la console ;
- redirection vers `/login` avec conservation d'une destination interne sûre ;
- client navigateur avec cookies, CSRF et sans Bearer humain ;
- aucune donnée d'authentification dans `localStorage` ou `sessionStorage` ;
- affichage de l'identifiant connecté et bouton de déconnexion ;
- redirection après expiration ou réponse administrative `401` ;
- anciennes recettes Chromium migrées vers la connexion humaine.

## Recette automatisée VPS

```sh
cd /home/debian/motorsports-events-server-lot42-test
git switch codex/lot-4.4
git pull --ff-only origin codex/lot-4.4

sudo env \
  LOT44_UI_PROJECT=mse-lot44-auth-ui-vps \
  LOT44_UI_POSTGRES_PORT=55466 \
  LOT44_UI_API_PORT=3571 \
  LOT44_UI_WEB_PORT=3570 \
  ./scripts/test-lot44-auth-ui.sh
```

Résultat attendu :

```text
Tests Chromium Authentification Lot 4.4 étape 3 : OK
```

La pile et ses données sont isolées et supprimées automatiquement. Le mot de
passe employé est une fixture éphémère, jamais un secret de production.

## Contrôle graphique facultatif

Pendant une pile active, ouvrir `http://127.0.0.1:3570` depuis un tunnel local
et vérifier la page de connexion, le retour à la page demandée, l'identifiant
dans la barre supérieure et la déconnexion. La recette automatisée ferme sa
pile à la fin ; pour ce contrôle, démarrer une pile dédiée séparément.

## Levée du point d'arrêt

Le mainteneur a explicitement validé cette étape le 2026-08-11. La
finalisation/hardening de l'étape 4 peut désormais commencer séparément.
