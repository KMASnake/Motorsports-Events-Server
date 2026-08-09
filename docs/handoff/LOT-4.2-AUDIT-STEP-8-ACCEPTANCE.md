# Acceptation Lot 4.2 — étape 8

## État

La recette technique VPS de l'étape 7 est validée. Cette étape 8 prépare la
validation humaine finale sur Windows. Le Lot 4.2 reste non validé tant que le
mainteneur n'a pas confirmé explicitement la checklist ci-dessous.

## Préconditions Windows

- branche `codex/lot-4.2-complete` à jour ;
- Docker Desktop démarré ;
- Node.js 22 ou supérieur ;
- npm 10 ou supérieur ;
- ports locaux 3600, 3601 et 55436 disponibles.

## Installation et recette automatisée

Dans PowerShell ou `cmd.exe` :

```bat
cd C:\Users\micle\Motorsports-Events-Server
git switch codex/lot-4.2-complete
git pull --ff-only
scripts\test-lot42-final.cmd
```

Le script reconstruit une pile Docker isolée, injecte un jeu synthétique
reproductible et exécute audit, lint, typecheck, 75 tests unitaires, builds,
contrôle bloquant des données synthétiques, validateurs API et sept scénarios
Chromium. Il ne contacte ni ne modifie la production.

Le jeton administrateur temporaire est copié dans le presse-papiers sans être
affiché. Le coller dans l'écran d'authentification de l'interface ; il expire
après quatre heures.

Résultat de données attendu : 12 championnats, 40 circuits, 96 événements,
32 événements fournisseur et 12 corrections.

## Checklist humaine

Ouvrir <http://localhost:3600> puis confirmer :

- [ ] Tableau de bord et Championnats s'affichent, avec logos et fallbacks ;
- [ ] Événements s'ouvre en vue Mois avec légende des championnats visibles ;
- [ ] les vues Mois, Semaine, Jour, Agenda et Liste s'affichent correctement ;
- [ ] précédent/suivant avance selon la vue active, et Aujourd'hui recentre ;
- [ ] les drapeaux sont locaux, lisibles et sans image cassée ;
- [ ] le filtre Fournisseur propose OC BlackTop, TheSportsDB, Motorsports Events
  et toute source synthétique supplémentaire ;
- [ ] la vue Liste affiche 25 éléments par page et trie avant pagination ;
- [ ] création, modification, duplication, déplacement et redimensionnement
  persistent après actualisation ;
- [ ] un refus de mutation restaure visuellement la valeur précédente ;
- [ ] Corrections affiche dix lignes par page, les vrais noms et les filtres ;
- [ ] Modifier local utilise une liste métier ou un sélecteur date/heure adapté ;
- [ ] Restaurer fournisseur retire la correction locale ;
- [ ] `postponed` apparaît comme « Reporté » ;
- [ ] aucun champ Slug, Origine ou Fuseau horaire n'apparaît dans les formulaires ;
- [ ] l'API publique reste accessible sans jeton et n'expose pas les métadonnées
  fournisseur ;
- [ ] aucun service, port ou volume de production n'a été utilisé.

Tester également à 1440×900 et 1280×720. Noter séparément l'écart UX connu :
la vue Agenda fonctionne comme une liste chronologique sur trente jours, mais
son objectif pourra être clarifié dans une évolution ultérieure.

## Nettoyage et rollback

```bat
scripts\test-lot42-final.cmd -Cleanup
```

Cette commande supprime uniquement les conteneurs, le réseau et le volume du
projet Docker `mse-lot42-final`. La production n'est jamais ciblée.

## Clôture

Après réussite, le mainteneur doit confirmer explicitement la validation du Lot
4.2. Codex consignera alors la date, le périmètre, le SHA testé et les résultats
dans `PROJECT-STATUS.json`, `docs/handoff/PROGRESS.json` et `CHANGELOG.md` avant
toute autorisation de fusion.
