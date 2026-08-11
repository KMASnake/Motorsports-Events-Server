# Lot 4.4 — Validation de l'étape 1

Date : 2026-08-11

Statut : `maintainer-validated`

Validation mainteneur : confirmée le 2026-08-11 sur une pile Docker VPS
isolée. La recette s'est terminée par `Tests Lot 4.4 étape 1 : OK`.

## Périmètre

- migration réversible `0006_admin_console_authentication` ;
- compte administrateur singleton ;
- hash Argon2id selon l'ADR-0014 ;
- création initiale et récupération par CLI ;
- révocation des sessions lors d'un changement de mot de passe ;
- aucune route de login, aucun cookie et aucune interface Web à cette étape.

## Recette automatisée

Depuis la racine du dépôt :

```sh
git switch codex/lot-4.4
git pull --ff-only origin codex/lot-4.4
sudo env \
  LOT44_PROJECT=mse-lot44-auth-foundation-vps \
  LOT44_POSTGRES_PORT=55464 \
  ./scripts/test-lot44-auth-foundation.sh
```

La recette utilise une base et un volume isolés, puis les supprime. Elle doit
terminer par `Tests Lot 4.4 étape 1 : OK`.

## Bootstrap manuel futur

Après application de la migration dans une installation réelle, la commande
interactive ne place pas le mot de passe dans les arguments ou l'environnement :

```sh
npm run admin -- create --username admin
```

Dans Docker, une entrée non interactive peut être transmise par le standard
input avec `--password-stdin`. Le mot de passe réel ne doit jamais être écrit
dans une documentation, un fichier versionné ou l'historique du shell.

## Levée du point d'arrêt

Le mainteneur a explicitement validé cette étape le 2026-08-11. Les routes de
login/session de l'étape 2 peuvent désormais être développées séparément.
