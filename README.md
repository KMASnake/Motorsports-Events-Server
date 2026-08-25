# Motorsports Events Server

> **Source de vérité permanente :** consultez le
> [Project Handbook](PROJECT-HANDBOOK.md) avant toute modification du dépôt.
> L’état courant d’un lot est suivi dans `docs/handoff/PROGRESS.json` et les
> documents de `docs/handoff/` apportent les preuves de validation associées.

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

Les anciens handovers, décisions et références restent conservés sous :

```text
docs/handover/
docs/decisions/
docs/reference/
```

Ils servent d’historique et ne doivent pas être confondus avec les sources de vérité actives.

## Plateforme cible

Console d’administration desktop :

- résolution de référence : 1440 × 900 ;
- minimum supporté : 1280 × 720 ;
- aucune optimisation smartphone requise.
