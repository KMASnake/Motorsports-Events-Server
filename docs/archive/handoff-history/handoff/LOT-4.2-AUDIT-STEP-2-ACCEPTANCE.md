# Recette — remédiation audit Lot 4.2, étape 2

## Objet

Vérifier sur PostgreSQL isolé que chaque valeur locale est validée selon son
champ métier, que les références existent et que les dates sont normalisées en
UTC. Le validateur crée puis supprime son événement fournisseur synthétique.

## Démarrage VPS isolé

```bash
export COMPOSE_PROJECT_NAME=mse-audit-step2-vps
export POSTGRES_PORT=55453 API_HOST_PORT=3471 WEB_HOST_PORT=3470
export POSTGRES_PASSWORD=step2-typed-password
export DATABASE_URL=postgresql://mse:step2-typed-password@postgres:5432/motorsports_events
export VITE_API_URL=http://localhost:3471
sudo -E docker compose up --build -d
```

## Validateur sans Node installé sur l'hôte

```bash
sudo docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3471 \
  -v "$PWD/scripts:/scripts:ro" \
  node:22-alpine node /scripts/validate-audit-step2.mjs
```

Résultat attendu :

```text
Validation typée des corrections : OK
Types incompatibles rejetés en 400 : OK
Référence inexistante rejetée en 400 : OK
Date avec offset normalisée en UTC : OK
```

## Nettoyage

```bash
sudo -E docker compose down --volumes --remove-orphans
```
