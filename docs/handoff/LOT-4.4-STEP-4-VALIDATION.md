# Lot 4.4 — Validation de l'étape 4

Date : 2026-08-12

Statut : `maintainer-validated-awaiting-merge`

Validation mainteneur : réalisée le 2026-08-12 sur Windows avec Docker Desktop
et Chromium, puis sur un VPS Docker isolé. Cette validation est distincte de
la future fusion dans `main`.

## Résultats mainteneur

- Windows : services sains, authentification manuelle réussie et recette
  Chromium terminée avec `1 passed` ;
- VPS : recette finale terminée avec succès après libération d'un port occupé
  par une ancienne pile Lot 4.3 ;
- API : santé PostgreSQL confirmée ;
- session : connexion, restauration de destination, persistance au
  rechargement, logout et révocation confirmés ;
- origine locale : recette et documentation alignées sur
  `http://127.0.0.1:3600`.

## Périmètre

- durcissement des tests de session, cookies, CSRF, anti-bruteforce et audit ;
- vérification du stockage opaque des sessions ;
- vérification de la persistance des sessions après redémarrage API ;
- vérification de la coexistence HMAC admin, refus viewer et API publique ;
- bootstrap de l'administrateur humain dans la CI avant Playwright ;
- recettes finales Linux/VPS et Windows.

## Recette automatisée VPS

```sh
cd /home/debian/motorsports-events-server-lot42-test
git switch codex/lot-4.4
git pull --ff-only origin codex/lot-4.4

sudo env \
  LOT44_FINAL_PROJECT=mse-lot44-final-vps \
  ./scripts/test-lot44-final.sh
```

Résultat attendu :

```text
Recette finale Lot 4.4 : OK
```

La recette Linux utilise `node:22-alpine` pour les étapes Node afin de ne pas
dépendre de Node installé sur le VPS. Les piles Docker créées sont isolées par
nom de projet et supprimées par chaque recette intermédiaire.

## Recette automatisée Windows

Depuis PowerShell dans le dépôt :

```powershell
git switch codex/lot-4.4
git pull --ff-only origin codex/lot-4.4
.\scripts\test-lot44-final.cmd
```

Résultat attendu :

```text
Recette automatisée Lot 4.4 : OK
Interface : http://127.0.0.1:3600
API       : http://127.0.0.1:3601/health
Identifiant : admin
Mot de passe de test : correct horse battery staple
```

Nettoyage après validation :

```powershell
.\scripts\test-lot44-final.cmd -Cleanup
```

## Points à valider humainement

- `http://127.0.0.1:3600` affiche la page de connexion sans champ HMAC ;
- l'identifiant `admin` et le mot de passe de test ouvrent la console ;
- la destination demandée avant login est restaurée ;
- le bouton `Se déconnecter` renvoie vers `/login` ;
- une visite directe de `/events` après logout redirige vers `/login`.

## Critères techniques couverts

- `npm audit --audit-level=high`, lint, typecheck, tests et build ;
- migration/rollback du socle auth par `test-lot44-auth-foundation.sh` ;
- API auth par `test-lot44-auth-api.sh` ;
- UI auth Chromium par `test-lot44-auth-ui.sh` ;
- bootstrap CI de l'administrateur humain avant les tests Chromium ;
- aucune exposition de mot de passe dans les logs Docker de la recette API.

## Point d'arrêt

La validation mainteneur est acquise. La CI doit encore réussir sur le SHA
publié avant fusion. La fusion dans `main` ne constitue pas une validation
utilisateur supplémentaire.
