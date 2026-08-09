# Recette — remédiation audit Lot 4.2, étape 4

## Objet

Créer 27 événements et quatre corrections synthétiques afin de valider la
pagination après tri/filtrage, les rejets `400`, l'unicité fournisseur et le
journal acteur/avant/après/requête. Toutes les fixtures sont supprimées.

## Commandes VPS

```bash
export ADMIN_AUTH_SECRET="$(openssl rand -hex 32)"
export ADMIN_TOKEN="$(sudo -E docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=admin -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
export COMPOSE_PROJECT_NAME=mse-audit-step4-vps
export POSTGRES_PORT=55457 API_HOST_PORT=3511 WEB_HOST_PORT=3510
export POSTGRES_PASSWORD=step4-audit-password
export DATABASE_URL=postgresql://mse:step4-audit-password@postgres:5432/motorsports_events
export VITE_API_URL=http://localhost:3511
sudo -E docker compose up --build -d
```

```bash
sudo -E docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3511 -e ADMIN_TOKEN \
  -v "$PWD/scripts:/scripts:ro" \
  node:22-alpine node /scripts/validate-audit-step4.mjs
```

Résultat attendu :

```text
Pagination et tri serveur avant découpage : OK
Filtres invalides rejetés en 400 : OK
Identité fournisseur unique : OK
Journal acteur/avant/après/requête sans secret : OK
```

Nettoyage : `sudo -E docker compose down --volumes --remove-orphans`.
