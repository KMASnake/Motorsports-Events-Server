# Motorsports Events Server

Serveur central indépendant de la plateforme Motorsports Events.

Ce dépôt ne contient ni le plugin MyBB ni l’application Android. Ces clients
évolueront dans des dépôts séparés et communiqueront avec le serveur par l’API.

## Base fonctionnelle

La base importée correspond au serveur **2.4.0 validé sur VPS** :

- FastAPI ;
- PostgreSQL ;
- scheduler ;
- OCBlackTop ;
- TheSportsDB ;
- Caddy ;
- installation Docker ;
- sauvegarde, mise à niveau et rollback.

## Structure

```text
motorsports-events-server/
├── server/               Application FastAPI
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

## Génération d’une release

```bash
./scripts/build-release.sh
```

## Clients compatibles

Les clients sont développés séparément :

- `motorsports-events-mybb`
- `motorsports-events-android`

Le contrat entre les projets est l’API REST versionnée du serveur.
