# Codex — Instructions de reprise

## Ordre de lecture obligatoire

1. `README.md`
2. `PROJECT-STATUS.json`
3. `docs/handover/LOT-4-REV-1-HANDOFF.md`
4. `docs/handover/LOT-4-REV-1-VPS-VALIDATION.md`
5. `docs/handover/PROGRESS.json`
6. `docs/handover/LOT-4-REV-1-ACCEPTANCE.md`

## Base fiable

Le lot `v8.1.0-alpha.2-lot.4-rev.1` est validé par l'utilisateur sur un VPS
isolé. La PR #24 doit être fusionnée avant de commencer un nouveau lot.

## Mission

Relire et fusionner la PR #24, vérifier `main`, puis attendre le choix explicite
du prochain lot.

## Contraintes absolues

- maquettes validées = contrat visuel ;
- objectif de fidélité >= 95 % ;
- calendrier par défaut, liste secondaire ;
- aucune régression Championnats ;
- catégorie facultative ;
- aucune création implicite de catégorie ;
- création manuelle sans provider ;
- aucune métadonnée provider dans l'API publique ;
- interface desktop seulement ;
- compilation, Docker et tests obligatoires.

## Avant toute PR

- mettre à jour `PROJECT-STATUS.json` ;
- mettre à jour `docs/handover/PROGRESS.json` ;
- joindre les captures avant/après ;
- documenter les écarts résiduels ;
- indiquer précisément les commandes exécutées et leurs résultats.
