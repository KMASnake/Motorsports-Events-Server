# Recette — remédiation audit Lot 4.2, étape 5

## Objet

Valider sur PostgreSQL réel la sérialisation de deux résolutions concurrentes,
la concurrence entre synchronisation fournisseur et modification
administrative, ainsi que le rollback atomique de l'événement et de ses
corrections. La fixture traverse le passage à l'heure d'été et est supprimée à
la fin du test.

L'interface ajoute aussi :

- création d'une plage en faisant `Maj + clic` sur la date de début puis la
  date de fin ;
- redimensionnement visuel par pas de 30 minutes ;
- restauration de l'état affiché si l'API refuse un déplacement ou un
  redimensionnement ;
- calcul des durées par instants UTC, y compris à minuit et aux changements
  d'heure.

## Commandes VPS

```bash
cd /home/debian/motorsports-events-server-lot42-test
git pull --ff-only

export ADMIN_AUTH_SECRET="$(openssl rand -hex 32)"
export ADMIN_TOKEN="$(sudo -E docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=admin -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
export COMPOSE_PROJECT_NAME=mse-audit-step5-vps
export POSTGRES_PORT=55458 API_HOST_PORT=3521 WEB_HOST_PORT=3520
export POSTGRES_PASSWORD=step5-audit-password
export DATABASE_URL=postgresql://mse:step5-audit-password@postgres:5432/motorsports_events
export VITE_API_URL=http://localhost:3521
sudo -E docker compose up --build -d
```

```bash
sudo -E docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3521 -e ADMIN_TOKEN \
  -v "$PWD/scripts:/scripts:ro" \
  node:22-alpine node /scripts/validate-audit-step5.mjs
```

Résultat attendu :

```text
Deux résolutions simultanées sérialisées sans corruption : OK
Synchronisation fournisseur et modification administrateur sérialisées : OK
Rollback transactionnel événement/corrections après erreur : OK
Fixture UTC traversant le changement d’heure conservée : OK
```

Ouvrir `http://localhost:3520` par tunnel SSH et vérifier sur Événements :

1. `Maj + clic` sur deux jours ouvre l'éditeur avec début et fin préremplis ;
2. les boutons `−30 min` et `+30 min` modifient la fin de l'événement ;
3. un événement de 23 h 30 à 1 h reste affiché sur sa date de départ sans
   durée négative.

Nettoyage systématique :

```bash
sudo -E docker compose down --volumes --remove-orphans
```
