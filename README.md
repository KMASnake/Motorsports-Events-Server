# Motorsports Events Server — GitHub Handover

Ce dépôt constitue le package de passation complet destiné à GitHub et Codex.

> **Source de vérité permanente :** consultez le
> [Project Handbook](PROJECT-HANDBOOK.md) avant toute modification du dépôt.
> Les documents de `docs/handoff/` complètent le Handbook uniquement pour le
> périmètre et l'état d'un lot donné.

## État du dépôt

La racine contient le **lot 4 rev.1**, qui réunit le CRUD des événements, les
API publique/administration et la vue calendrier restaurée. Ce candidat a été
validé par l'utilisateur le 1er août 2026 sur un environnement VPS isolé.

Le dernier jalon entièrement validé est :

```text
v8.1.0-alpha.2-lot.4-rev.1
```

Le rapport de validation et la passation sont conservés dans :

```text
docs/handover/LOT-4-REV-1-VPS-VALIDATION.md
docs/handover/LOT-4-REV-1-HANDOFF.md
```

## Prochaine action

Relire puis fusionner la PR #24 dans `main`, vérifier la CI après fusion et
choisir explicitement le prochain lot. Ne pas installer cette architecture 8.1
sur la production historique 2.7.0 avec l'ancien script de mise à niveau.

## Maquettes officielles

```text
docs/ui-reference/validated-mockups/
```

Les maquettes sont un contrat visuel. Elles ne sont pas de simples exemples.

## Documentation historique

```text
docs/reference/documentation-v7.0.0/
```

Elle contient les spécifications UI et d'architecture produites avant le
développement du socle exécutable.

## Démarrage local

Sous Windows :

```cmd
scripts\reset-dev.cmd
```

Validation du dernier lot :

```cmd
scripts\test-lot4.cmd
```

Le lot ne doit être déclaré validé qu'après :

- build TypeScript web ;
- build API ;
- trois conteneurs healthy ;
- validation API ;
- test visuel ;
- comparaison à la maquette ;
- mise à jour de `PROJECT-STATUS.json` et des documents de passation.

## Plateforme cible

Console d'administration desktop :

- résolution de référence : 1440 × 900 ;
- minimum supporté : 1280 × 720 ;
- aucune optimisation smartphone requise.
