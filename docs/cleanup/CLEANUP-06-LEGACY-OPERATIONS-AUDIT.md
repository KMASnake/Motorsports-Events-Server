# CLEANUP-06 — Audit des outils d’exploitation legacy

Baseline de nettoyage : branche `cleanup/architecture-state-model` issue de la baseline fonctionnelle `8a603232bfec44711cfac382e4f73687dd370e53`.

## Conclusion

Les outils d’exploitation historiques de la racine et de `scripts/` ne peuvent pas être supprimés avant le cutover Production Node.

Ils constituent encore l’interface d’exploitation/rollback de la production Python 2.7.0, alors que la préproduction cible repose désormais sur `apps/api`, `apps/web`, PostgreSQL et `docker-compose.preprod.yml`.

La bonne action pour CLEANUP-06 est donc **FREEZE / DEPRECATE**, pas une suppression fichier par fichier.

## Entry points racine

Les fichiers suivants sont de simples façades qui délèguent vers `scripts/` :

- `start.sh` → `scripts/start.sh`
- `stop.sh` → `scripts/stop.sh`
- `restart.sh` → `scripts/restart.sh`
- `backup.sh` → `scripts/backup.sh`
- `restore.sh` → `scripts/restore.sh`
- `upgrade.sh` → `scripts/upgrade.sh`
- `show-keys.sh` → `scripts/show-keys.sh`

Ils sont redondants d’un point de vue dépôt, mais ils peuvent encore être utilisés comme interface opérateur de la production historique. Ils restent donc en place jusqu’au cutover.

## Scripts d’exploitation historiques

### KEEP / FROZEN jusqu’au cutover

- `install.sh`
- `scripts/start.sh`
- `scripts/stop.sh`
- `scripts/restart.sh`
- `scripts/lib.sh`
- `scripts/backup.sh`
- `scripts/restore.sh`
- `scripts/verify-backup.sh`
- `scripts/upgrade.sh`
- `scripts/preflight-upgrade.sh`
- `scripts/upgrade-files.sh`
- `scripts/build-release.sh`
- `scripts/detect-environment.py`
- `scripts/configure.py`
- `scripts/env_get.py`
- `scripts/healthcheck.py`
- `scripts/first-sync.py`
- `scripts/show-keys.sh`
- les scripts de monitoring legacy qui dépendent de cette stack.

Ces outils ne doivent recevoir que des correctifs indispensables au maintien de la production historique.

## Raisons techniques de ne pas les réutiliser pour la cible Node

Plusieurs scripts encodent encore des hypothèses de l’ancienne architecture :

- détection VPS/Synology et profils Compose historiques ;
- services Compose nommés `db`, `scheduler` ou images legacy ;
- configuration à partir de `.env` historique ;
- `install.sh` annonce encore Motorsports Events Server `2.1.0` ;
- `restore.sh` stoppe/redémarre `api scheduler` ;
- `upgrade.sh` supprime/reconstruit des images `motorsports-events-server-api` et `motorsports-events-server-scheduler` ;
- la chaîne d’upgrade contrôle la production historique via `VERSION` et `/api/v1/version` ;
- `show-keys.sh` affiche explicitement des clés d’API legacy et ne doit pas être présenté comme un outil de la cible Node.

La préproduction Node doit continuer à utiliser ses procédures déclaratives spécifiques et ne doit pas être pilotée par ces scripts legacy.

## Politique jusqu’au cutover

1. Ne pas supprimer ces outils.
2. Ne pas les étendre pour la nouvelle architecture Node.
3. Ne pas créer de nouveaux appels depuis `apps/api`, `apps/web`, le worker Node ou le Compose préprod vers ces scripts.
4. Toute correction doit être étiquetée legacy et limitée à la continuité/rollback Production.
5. Les procédures Node doivent vivre sous `infra/`, `docker-compose.preprod.yml`, les scripts de migration PostgreSQL Node et les documents d’exploitation dédiés.

## Après cutover Production Node

Un seul lot de suppression devra retirer ensemble :

- les wrappers racine listés ci-dessus ;
- `install.sh` legacy ;
- les scripts d’exploitation Python/VPS/Synology devenus inutiles ;
- les helpers Python utilisés uniquement par cette chaîne ;
- les scripts de backup/restore legacy après remplacement par leur équivalent PostgreSQL Node certifié ;
- le Caddy/runtime historique associé ;
- les références documentaires et tests imposant encore ces outils.

La suppression doit être atomique avec la fin de la capacité de rollback Python, jamais avant.

## Classification

| Groupe | Statut actuel | Action future |
|---|---|---|
| wrappers racine | FROZEN | supprimer après cutover |
| install / start / stop / restart legacy | FROZEN | supprimer/remplacer après cutover |
| backup / restore legacy | FROZEN CRITICAL | remplacer puis supprimer |
| upgrade / preflight / release legacy | FROZEN CRITICAL | remplacer puis supprimer |
| helpers Python exploitation | FROZEN | supprimer si aucun autre consommateur |
| show-keys | FROZEN / SENSITIVE | supprimer après cutover |
| préprod Node declarative | ACTIVE | conserver |

## Résultat CLEANUP-06

- suppression d’outil d’exploitation : **NON** ;
- risque production/rollback introduit : **NON** ;
- frontière legacy/Node documentée : **OUI** ;
- réutilisation de scripts legacy par la cible Node : **INTERDITE**.
