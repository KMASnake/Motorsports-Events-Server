# Codex — Instructions de reprise

## Ordre de lecture obligatoire

1. `README.md`
2. `PROJECT-STATUS.json`
3. `docs/handover/CODEX-EXECUTION-PROMPT-LOT-4-REV-1.md`
4. `docs/handover/LOT-4-REV-1-CALENDAR-SPEC.md`
5. `docs/handover/LOT-4-REV-1-ACCEPTANCE.md`
6. `docs/handover/LOT-4-REV-1-ADR.md`
7. `docs/ui-reference/validated-mockups/events-validated.png`

## Base fiable

Le dernier jalon totalement validé est conservé dans :

```text
releases/validated/Motorsports-Events-Server-v8.1.0-alpha.2-lot.3-rev.5.zip
```

La racine est le lot 4 de travail. Ne pas confondre « présent dans le code »
et « validé par l'utilisateur ».

## Mission

Restaurer la vue calendrier Événements sans perdre :

- CRUD ;
- liste ;
- filtres ;
- publication ;
- API publique ;
- API d'administration.

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
