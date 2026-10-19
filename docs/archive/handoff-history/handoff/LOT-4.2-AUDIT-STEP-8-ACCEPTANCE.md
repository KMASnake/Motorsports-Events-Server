# Acceptation Lot 4.2 — étape 8

## État

La recette technique VPS de l'étape 7 est validée. Après la recette Windows du
2026-08-10, le défaut d'affichage des logos du Tableau de bord a été corrigé et
le mainteneur a confirmé leur rendu sur le SHA
`7d67672a6a7a067ca4f4594284a917fd78afc6d4`.

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

- [x] Tableau de bord affiche les six logos ou fallbacks des prochaines séances ;
- [x] Championnats s'affiche avec logos et fallbacks ;
- [x] Événements s'ouvre en vue Mois avec légende des championnats visibles ;
- [x] les vues Mois, Semaine, Jour, Agenda et Liste s'affichent correctement ;
- [x] précédent/suivant avance selon la vue active, et Aujourd'hui recentre ;
- [x] les drapeaux sont locaux, lisibles et sans image cassée ;
- [x] le filtre Fournisseur propose OC BlackTop, TheSportsDB, Motorsports Events
  et toute source synthétique supplémentaire ;
- [x] la vue Liste affiche 25 éléments par page et trie avant pagination ;
- [x] création, modification, duplication, déplacement et redimensionnement
  persistent après actualisation ;
- [x] un refus de mutation restaure visuellement la valeur précédente ;
- [x] Corrections affiche dix lignes par page, les vrais noms et les filtres ;
- [x] Modifier local utilise une liste métier ou un sélecteur date/heure adapté ;
- [x] Restaurer fournisseur retire la correction locale ;
- [x] `postponed` apparaît comme « Reporté » ;
- [x] aucun champ Slug, Origine ou Fuseau horaire n'apparaît dans les formulaires ;
- [x] l'API publique reste accessible sans jeton et n'expose pas les métadonnées
  fournisseur ;
- [x] aucun service, port ou volume de production n'a été utilisé.

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

Le mainteneur a confirmé « ok les logos » le 2026-08-10. Cette revalidation
referme le dernier écart de l'étape 8. La fusion reste une opération distincte.
