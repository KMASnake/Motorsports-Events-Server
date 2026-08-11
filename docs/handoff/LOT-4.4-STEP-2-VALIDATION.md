# Lot 4.4 — Validation de l'étape 2

Date : 2026-08-11

Statut : `maintainer-validated`

Validation mainteneur : confirmée le 2026-08-11 après réussite complète de la
recette Docker sur le VPS.

## Périmètre

- `POST /api/v1/auth/login` ;
- `GET /api/v1/auth/session` ;
- `POST /api/v1/auth/logout` ;
- sessions opaques PostgreSQL, idle 1 heure et maximum absolu 8 heures ;
- cookies locaux et production aux attributs distincts ;
- double-submit CSRF signé et lié à la session ;
- blocage global après cinq échecs en quinze minutes pendant quinze minutes ;
- audit sans secret ;
- coexistence prioritaire avec le Bearer HMAC technique.

L'interface React `/login` reste hors de cette étape.

## Recette automatisée VPS

```sh
cd /home/debian/Motorsports-Events-Server
git switch codex/lot-4.4
git pull --ff-only origin codex/lot-4.4

sudo env \
  LOT44_PROJECT=mse-lot44-auth-api-vps \
  LOT44_POSTGRES_PORT=55465 \
  LOT44_API_PORT=3561 \
  ./scripts/test-lot44-auth-api.sh
```

La recette crée son compte avec une valeur factice uniquement dans une base
éphémère, teste les contrats HTTP et supprime ensuite conteneurs et volume. Le
VPS n'a besoin que de Docker, `curl` et Python 3 ; Node.js n'est pas requis sur
l'hôte. Le
résultat attendu est :

```text
Tests Lot 4.4 étape 2 : OK
```

## Levée du point d'arrêt

Le mainteneur a explicitement validé cette étape le 2026-08-11. La page React
`/login` et les gardes de navigation peuvent désormais être développées dans
l'étape 3.
