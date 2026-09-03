# CLEANUP-05-B — Audit des références des candidats faibles

Date : 2026-08-25
Branche : `cleanup/architecture-state-model`

## Objectif

Auditer les candidats faibles identifiés en CLEANUP-05-A et ne supprimer que les wrappers/recettes pour lesquels aucun consommateur actif n'est identifié dans les entrées d'exécution actuelles (CI, `package.json`, Compose, Makefile) ni dans la recherche de références du dépôt.

## Sources d'autorité contrôlées

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/validate.yml`
- `.github/workflows/docker.yml`
- `docker-compose.yml`
- `docker-compose.preprod.yml`
- `docker-compose.test.yml`
- `Makefile`
- recherche de références textuelles dans le dépôt pour chaque wrapper supprimé

## Suppressions retenues

| Fichier supprimé | Nature | Cible réelle | Consommateur actif identifié | Décision |
|---|---|---|---|---|
| `scripts/test-lot2.cmd` | wrapper Windows | `node scripts/validate-lot2.mjs` | aucun | supprimé |
| `scripts/test-lot3.cmd` | wrapper Windows | `scripts/test-lot3.ps1` | aucun | supprimé |
| `scripts/test-lot4.cmd` | wrapper Windows | `node scripts/validate-lot4.mjs` | aucun | supprimé |
| `scripts/test-lot42-final.cmd` | wrapper Windows | `scripts/test-lot42-final.ps1` | aucun | supprimé |
| `scripts/test-lot43-final.cmd` | wrapper Windows | `scripts/test-lot43-final.ps1` | aucun | supprimé |
| `scripts/test-lot44-final.cmd` | wrapper Windows | `scripts/test-lot44-final.ps1` | aucun | supprimé |

Ces six fichiers sont de simples lanceurs. Ils n'implémentent pas de logique métier, de fixture, de migration, de validation autonome ou de contrat CI. Leur cible reste présente lorsqu'elle est encore pertinente.

## Raisons de sûreté

### Lot 2

`test-lot2.cmd` ne faisait qu'appeler `validate-lot2.mjs`. Le validateur reste directement exposé par `package.json` via `validate:lot2`.

### Lot 3

`test-lot3.cmd` ne faisait qu'appeler `test-lot3.ps1`. La recette PowerShell reste directement exposée par `package.json` via `test:lot3`.

### Lot 4

`test-lot4.cmd` ne faisait qu'appeler `validate-lot4.mjs`. Le validateur reste directement exposé par `package.json` via `validate:lot4`, et il est aussi exécuté par la CI Node actuelle.

### Lots 4.2, 4.3 et 4.4

Les trois fichiers `*-final.cmd` ne faisaient qu'ajouter une couche `cmd.exe` devant leur recette PowerShell respective. Les recettes `.ps1` ont été conservées dans ce sous-lot : elles contiennent encore une orchestration substantielle et ne sont donc pas assimilées à des wrappers morts sans audit fonctionnel supplémentaire.

## Candidats explicitement conservés

Les éléments suivants n'ont pas été supprimés dans CLEANUP-05-B :

- `scripts/test-lot1.ps1`
- `scripts/test-lot2.ps1`
- `scripts/test-lot42-final.ps1`
- `scripts/test-lot43-final.ps1`
- `scripts/test-lot44-final.ps1`
- `scripts/check-bootstrap.mjs`

Motif : ce sont des recettes ou validateurs contenant de la logique propre, ou leur absence de consommateur n'est pas encore suffisante à elle seule pour prouver qu'ils sont remplaçables sans perte d'une procédure manuelle historique utile.

Les scripts exposés par `package.json`, appelés par GitHub Actions, utilisés par Compose/release, ou appartenant aux certifications provider 5.x/5.7 restent hors périmètre de suppression.

## Résultat

CLEANUP-05-B retire uniquement six wrappers Windows redondants. Aucun validateur Node, aucune recette PowerShell substantielle, aucun script de release/exploitation, aucune migration et aucun test provider n'est supprimé.

Le prochain niveau d'audit peut classer les recettes PowerShell historiques restantes en trois états : `KEEP`, `ARCHIVE_DOC_ONLY`, `DELETE`, avec comparaison explicite de leur couverture face à la CI Node et aux scripts shell canoniques actuels.
