# Motorsports Events Server

Serveur central indépendant de la plateforme Motorsports Events.

Ce dépôt ne contient ni le plugin MyBB ni l’application Android. Ces clients
évolueront dans des dépôts séparés et communiqueront avec le serveur par l’API.

## Version courante

La candidate **2.7.0-alpha.4 — Administration modulaire** conserve le contrat
API v1 et poursuit le Jalon 4 :

- FastAPI ;
- PostgreSQL ;
- scheduler ;
- OCBlackTop ;
- TheSportsDB ;
- Caddy ;
- installation Docker ;
- sauvegarde, mise à niveau et rollback ;
- API v1 documentée ;
- synchronisation différentielle par curseur ;
- signalement et correction des incohérences horaires ;
- édition sécurisée du fichier `.env` depuis l'administration ;
- migrations de schéma versionnées avec Alembic ;
- contrôle automatique de la révision avant démarrage ;
- tests unitaires sans réseau pour OCBlackTop et TheSportsDB ;
- couverture des providers mesurée et contrôlée dans la CI ;
- environnement PostgreSQL 16 temporaire et isolé ;
- migrations et synchronisation testées avec un jeu de données reproductible ;
- routes d’administration isolées du point d’entrée de l’API publique.

## Structure

```text
motorsports-events-server/
├── server/               Application FastAPI
│   └── app/admin/        Routeurs d’administration
├── scripts/              Installation, exploitation et validation
├── docs/                 Documentation et décisions d’architecture
├── tests/                Tests du serveur
├── docker-compose.yml
├── Caddyfile
├── install.sh
├── upgrade.sh
└── VERSION
```

## Installation

```bash
chmod +x install.sh
sudo ./install.sh
```

## Validation du dépôt

```bash
./scripts/validate-repository.sh
```

Validation d’intégration PostgreSQL isolée :

```bash
./scripts/test-postgres.sh
```

## Génération d’une release

```bash
./scripts/build-release.sh
```

## Clients compatibles

Les clients sont développés séparément :

- `motorsports-events-mybb`
- `motorsports-events-android`

Le contrat entre les projets est l’API REST versionnée du serveur.

Voir :

- `docs/api-v1.md` ;
- `docs/clients/mybb.md` ;
- `docs/clients/android.md` ;
- `docs/compatibility.md`.
