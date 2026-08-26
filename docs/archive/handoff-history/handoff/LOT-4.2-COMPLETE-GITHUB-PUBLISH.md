# Publication GitHub — Lot 4.2 complet

Ce package est additif et unique. Il regroupe les spécifications fonctionnelles,
graphiques et de données hybrides.

## 1. Actualiser le dépôt

```powershell
cd C:\dev\Motorsports-Events-Server
git status
git checkout main
git pull origin main
```

Utiliser à la place de `main` la branche contenant le dernier code validé si
nécessaire.

## 2. Créer la branche Codex

```powershell
git checkout -b codex/lot-4.2-complete
```

## 3. Copier le package

Décompresser le ZIP dans un dossier temporaire puis copier son contenu à la
racine du dépôt.

## 4. Vérifier

```powershell
git status
git diff --stat
```

Avant Codex, seuls ces emplacements doivent être ajoutés ou modifiés :

```text
docs/
.github/
LOT-4.2-COMPLETE-PACKAGE-INFO.json
PACKAGE-MANIFEST.json
```

## 5. Commit et push

```powershell
git add docs .github LOT-4.2-COMPLETE-PACKAGE-INFO.json PACKAGE-MANIFEST.json
git commit -m "docs: prepare complete Codex lot 4.2"
git push -u origin codex/lot-4.2-complete
```

## 6. Instruction Codex

Copier le contenu de :

```text
docs/handoff/LOT-4.2-COMPLETE-CODEX-PROMPT.md
```
