# Motorsports Events Server

> **Règles permanentes :** [Project Handbook](PROJECT-HANDBOOK.md)  
> **État courant et prochaine action :** [docs/handoff/PROGRESS.json](docs/handoff/PROGRESS.json)

## Navigation documentaire

Les documents actifs sont accessibles directement depuis cette page :

- [Project Handbook](PROJECT-HANDBOOK.md) — règles permanentes et architecture normative ;
- [État courant](docs/handoff/PROGRESS.json) — lot/gate actif, validations, autorisations, interdictions et prochaine action ;
- [Documentation active du lot courant](docs/handoff/README.md) — contrats et preuves, avec accès direct au dossier 5.7-P-F ;
- [Roadmap](docs/handbook/roadmap/ROADMAP.md) — trajectoire fonctionnelle uniquement ;
- [Décisions permanentes](docs/handbook/DECISIONS.md) et [ADR](docs/handbook/architecture/) ;
- [Archives documentaires](docs/archive/README.md) — preuves et documents clôturés.

`PROJECT_STATUS.md`, `PROJECT-STATUS.json` et `NEXT_STEPS.md` sont uniquement des pointeurs de compatibilité. Ils ne définissent pas l'état du projet.

## Architecture actuelle

Le dépôt contient temporairement deux générations du serveur :

- **cible active** : Node.js / TypeScript / PostgreSQL sous `apps/api`, `apps/web` et `infra/postgres` ;
- **production historique** : backend Python sous `server/`, conservé en mode **LEGACY / FROZEN** jusqu’au cutover Production Node.

L’architecture cible et le modèle d’états provider sont documentés dans :

```text
docs/architecture.md
docs/provider-state-model.md
```

Les règles applicables au backend historique sont documentées dans :

```text
server/LEGACY.md
docs/cleanup/CLEANUP-06-LEGACY-OPERATIONS-AUDIT.md
```

## Développement local Node

Sous Windows :

```cmd
scripts\reset-dev.cmd
```

Validation générique :

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Les validations historiques encore maintenues restent accessibles via les commandes `npm run ...` déclarées dans `package.json`, par exemple :

```bash
npm run validate:lot4
npm run test:lot44:final
npm run test:lot55
```

Ne pas utiliser d’ancien wrapper `.cmd` supprimé comme source canonique : `package.json` et les scripts shell/Node qu’il référence constituent les points d’entrée maintenus.

## Exploitation historique

Les scripts racine `start.sh`, `stop.sh`, `restart.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `show-keys.sh` ainsi que `install.sh` appartiennent encore à la chaîne d’exploitation/rollback historique.

Ils sont **gelés** :

- ne pas les étendre pour l’architecture Node ;
- ne pas les utiliser pour piloter la préproduction Node ;
- les conserver uniquement jusqu’au cutover Production Node et à la fin de la capacité de rollback Python.

La préproduction Node utilise sa configuration Compose et son infrastructure déclarative dédiées.

## Maquettes officielles

```text
docs/ui-reference/validated-mockups/
```

Les maquettes restent le contrat visuel de référence.

## Documentation historique

Les documents historiques sont indexés dans [docs/archive/README.md](docs/archive/README.md). Des répertoires historiques plus anciens peuvent encore subsister (`docs/handover/`, `docs/decisions/`, `docs/reference/`) pendant la transition, mais ils ne constituent aucune source de vérité active.

## Plateforme cible

Console d’administration desktop :

- résolution de référence : 1440 × 900 ;
- minimum supporté : 1280 × 720 ;
- aucune optimisation smartphone requise.
