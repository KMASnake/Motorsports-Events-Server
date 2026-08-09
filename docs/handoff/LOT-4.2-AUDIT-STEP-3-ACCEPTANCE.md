# Recette — remédiation audit Lot 4.2, étape 3

## Objet

Vérifier que les familles Événements, ingestion fournisseur et Corrections
retournent `401` sans jeton, invalide ou expiré, `403` pour un lecteur, et
acceptent un administrateur. Une fixture fournisseur synthétique est supprimée
en fin de recette.

## Jetons de recette

```bash
export ADMIN_AUTH_SECRET="$(openssl rand -hex 32)"
export ADMIN_TOKEN="$(sudo docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=admin -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
export VIEWER_TOKEN="$(sudo docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=viewer -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
export EXPIRED_TOKEN="$(sudo docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=admin -e ADMIN_TOKEN_LIFETIME_SECONDS=-1 -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
```

## Démarrage isolé

```bash
export COMPOSE_PROJECT_NAME=mse-audit-step3-vps
export POSTGRES_PORT=55454 API_HOST_PORT=3481 WEB_HOST_PORT=3480
export POSTGRES_PASSWORD=step3-security-password
export DATABASE_URL=postgresql://mse:step3-security-password@postgres:5432/motorsports_events
export VITE_API_URL=http://localhost:3481
sudo -E docker compose up --build -d
```

## Validation

```bash
sudo docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3481 \
  -e ADMIN_TOKEN -e VIEWER_TOKEN -e EXPIRED_TOKEN \
  -v "$PWD/scripts:/scripts:ro" \
  node:22-alpine node /scripts/validate-audit-step3.mjs
```

Résultat attendu :

```text
401 sans jeton, invalide ou expiré : OK
403 pour le rôle viewer : OK
Administrateur autorisé sur événements, fournisseur et corrections : OK
API publique sans authentification : OK
```

Nettoyage : `sudo -E docker compose down --volumes --remove-orphans`.
