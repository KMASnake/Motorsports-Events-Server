# Publication GitHub du package Lot 4.2

Ce package est additif : il ne remplace aucun fichier applicatif.

## Commandes

```powershell
cd C:\dev\Motorsports-Events-Server
git status
git pull origin main
git checkout -b codex/lot-4.2-calendar-interactive
```

Copier ensuite le contenu extrait du package à la racine du dépôt.

Vérifier :

```powershell
git status
git diff --stat
```

Aucun fichier sous `apps/`, `packages/` ou `scripts/` ne doit être modifié par
le simple dépôt de ce package.

Commit :

```powershell
git add docs .github LOT-4.2-PACKAGE-INFO.json
git commit -m "docs: prepare Codex lot 4.2 interactive calendar"
git push -u origin codex/lot-4.2-calendar-interactive
```

Puis donner à Codex le contenu de :

```text
docs/handoff/LOT-4.2-CODEX-PROMPT.md
```
