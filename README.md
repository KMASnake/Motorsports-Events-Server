# Motorsports Events Server — GitHub Handover

Ce dépôt constitue le package de passation complet destiné à GitHub et Codex.

## État du dépôt

La racine contient le code du **lot 4**, qui ajoute le CRUD des événements et
les API publique/administration. Ce lot n'est pas encore validé comme version
finale, car la vue calendrier validée a disparu.

Le dernier jalon entièrement validé sur le poste de l'utilisateur est :

```text
v8.1.0-alpha.2-lot.3-rev.5
```

Son archive exacte est conservée dans :

```text
releases/validated/
```

## Mission immédiate de Codex

Implémenter :

```text
v8.1.0-alpha.2-lot.4-rev.1
```

en suivant :

```text
docs/handover/CODEX-EXECUTION-PROMPT-LOT-4-REV-1.md
docs/handover/LOT-4-REV-1-CALENDAR-SPEC.md
docs/handover/LOT-4-REV-1-ACCEPTANCE.md
docs/handover/LOT-4-REV-1-ADR.md
```

Objectifs :

- restaurer le calendrier comme vue Événements par défaut ;
- conserver la vue liste et le CRUD du lot 4 ;
- conserver les API publique et administration ;
- atteindre au moins 95 % de fidélité à la maquette validée ;
- ne pas régresser sur le module Championnats.

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
