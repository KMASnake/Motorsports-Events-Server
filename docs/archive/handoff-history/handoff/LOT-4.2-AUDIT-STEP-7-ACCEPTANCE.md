# Recette — remédiation audit Lot 4.2, étape 7

## Objet

Valider le SHA candidat avec Node 22, npm 10, ESLint 9, PostgreSQL, Docker et
Chromium. La fusion et la validation globale restent interdites tant que les
checks GitHub du SHA exact et la recette VPS ne sont pas confirmés.

## Changements de contrôle

- ajout de `eslint.config.mjs` pour TypeScript, navigateur et Node ;
- ajout de `typescript-eslint` et `globals` comme dépendances de développement ;
- remplacement de `npm install` par `npm ci` dans la CI ;
- contrôle explicite de npm >= 10 et `npm audit --audit-level=high` ;
- exécution CI du lint, des 75 tests, des trois builds et des validateurs Lot 4,
  Étape 2 et Étape 3 ;
- démarrage et nettoyage automatiques d'une pile Docker/PostgreSQL isolée ;
- génération systématique du jeu de données `ci-final-sha` ;
- authentification des validateurs API et des sept scénarios Chromium.
- rotation Docker bornée sur les trois services persistants ;
- remplacement des assertions historiques `2.7.0` par la cohérence entre
  `VERSION.json` et les quatre packages du workspace 8.1.0.

## Recette VPS

```bash
cd /home/debian/motorsports-events-server-lot42-test
git switch codex/lot-4.2-complete
git pull --ff-only
git log -1 --oneline

export ADMIN_AUTH_SECRET="$(openssl rand -hex 32)"
export ADMIN_TOKEN="$(sudo -E docker run --rm -e ADMIN_AUTH_SECRET -e ADMIN_ROLE=admin -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/generate-admin-token.mjs)"
export COMPOSE_PROJECT_NAME=mse-audit-step7-vps
export POSTGRES_PORT=55460 API_HOST_PORT=3541 WEB_HOST_PORT=3540
export POSTGRES_PASSWORD=step7-audit-password
export DATABASE_URL=postgresql://mse:step7-audit-password@postgres:5432/motorsports_events
export VITE_API_URL=http://localhost:3541
sudo -E docker compose up --build -d
```

Contrôles Node 22/npm 10 :

```bash
sudo -E docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3541 -e ADMIN_TOKEN \
  -e DATABASE_URL=postgresql://mse:step7-audit-password@127.0.0.1:55460/motorsports_events \
  -v "$PWD":/source:ro -w /tmp/project node:22-alpine sh -lc '
    cp -a /source/. .
    npm ci
    npm audit --audit-level=high
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run data:generate -- --seed=vps-final-sha
    npm run validate:lot4
    npm run validate:step2
    npm run validate:step3
  '
```

Recette Chromium officielle :

```bash
sudo -E docker run --rm --network host \
  -e API_URL=http://127.0.0.1:3541 \
  -e WEB_URL=http://127.0.0.1:3540 \
  -e ADMIN_TOKEN \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test
```

Résultats attendus : zéro vulnérabilité, lint sans erreur, 75 tests unitaires,
trois validateurs réussis, trois builds réussis et `7 passed` sous Chromium.

Nettoyage :

```bash
sudo -E docker compose down --volumes --remove-orphans
```

## Résultat GitHub du candidat

SHA applicatif validé :
`a5f716cc0b216e49fde9a58eb7515f8489fee2a7`.

Checks réussis le 2026-08-10 :

- CI complète, y compris audit, lint, 75 tests, trois builds, trois validateurs,
  jeu de données déterministe et sept scénarios Chromium ;
- Docker build ;
- validation historique : 68 tests Python, quatre intégrations PostgreSQL,
  archive de livraison, SHA-256 et publication de l'artefact.

## Résultat VPS

Validation confirmée par le mainteneur le 2026-08-10 :

- installation de 289 paquets et `npm audit` à zéro vulnérabilité ;
- typecheck et lint API/Web réussis ;
- 48 tests API et 27 tests Web réussis ;
- builds API, Web et Types réussis ;
- jeu déterministe : 12 championnats, 40 circuits, 96 événements, 32 événements
  fournisseur et 12 corrections ;
- validateurs Lot 4, Étape 2 et Étape 3 réussis ;
- sept scénarios Chromium réussis dans l'image Playwright officielle.

L'avertissement npm `allow-scripts` concernant le postinstall d'`esbuild` est
informatif : l'installation, le build Vite et la recette Chromium ont réussi.
L'étape 7 est fermée techniquement. La validation globale du Lot 4.2 relève de
l'étape 8.
