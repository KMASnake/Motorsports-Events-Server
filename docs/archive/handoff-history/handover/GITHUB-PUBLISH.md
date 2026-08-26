# Publication sur GitHub

Depuis la racine extraite :

```powershell
git init
git add .
git commit -m "chore: handover Codex lot 4 rev.1"
git branch -M main
git remote add origin https://github.com/KMASnake/motorsports-events-server.git
git push -u origin main
```

Si le dépôt existe déjà, utiliser une branche :

```powershell
git checkout -b codex/lot-4-rev-1-calendar
git add .
git commit -m "docs: prepare Codex lot 4 rev.1 calendar restoration"
git push -u origin codex/lot-4-rev-1-calendar
```

Ne pas écraser un dépôt existant sans sauvegarde. Comparer d'abord son contenu
avec ce package.
