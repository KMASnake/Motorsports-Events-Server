# 8.1.0-alpha.2-lot.4

Cette révision corrige l'erreur suivante :

```text
'\' n'est pas reconnu en tant que commande interne ou externe
param : Le terme « param » n'est pas reconnu
```

Cause : un caractère antislash parasite avait été placé à la première ligne
des scripts PowerShell.

## Scripts corrigés

- `scripts/cleanup.ps1`
- `scripts/reset-dev.ps1`
- `scripts/cleanup.cmd`
- `scripts/reset-dev.cmd`

## Test recommandé

Depuis le dossier `scripts` :

```cmd
reset-dev.cmd
```

Ou depuis la racine du projet :

```cmd
scripts\reset-dev.cmd
```
