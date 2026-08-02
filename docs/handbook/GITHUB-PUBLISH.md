# Dépôt GitHub

```powershell
cd C:\dev\Motorsports-Events-Server
git status
git checkout main
git pull origin main
git checkout -b docs/project-handbook-v1
```

Copier le contenu du package à la racine du dépôt, puis :

```powershell
git status
git diff --stat
git add PROJECT-HANDBOOK.md CODEX-HANDBOOK.md README-HANDBOOK.md docs/handbook .github HANDBOOK-PACKAGE-INFO.json HANDBOOK-MANIFEST.json
git commit -m "docs: add project handbook v1.0"
git push -u origin docs/project-handbook-v1
```
