# 8.1.0-alpha.2-lot.4 — Shell global MEDS

## Objectif

Extraire le cadre global de l'application sans modifier les fonctions métier.

## Livré

- `AppShell` ;
- `Sidebar` ;
- `Topbar` ;
- `PageHeader` ;
- navigation centralisée et typée ;
- jeu d'icônes SVG MEDS sans dépendance externe ;
- horloge Europe/Paris réelle ;
- menu mobile ouvrable et refermable ;
- fermeture du menu après navigation ;
- ports Web/API/PostgreSQL configurables ;
- validation via Node.js, PowerShell ou `.cmd`.

## Critères d'acceptation

1. Build TypeScript et Docker réussi.
2. Trois conteneurs `healthy`.
3. Navigation vers toutes les routes inchangée.
4. Les badges de Corrections, Doublons, Conflits et Alertes restent visibles.
5. Sidebar, Topbar et PageHeader conservent le rendu de référence.
6. À moins de 800 px, le bouton menu ouvre une navigation latérale avec fond occultant.
7. Dashboard, Événements, Championnats et Synchronisations restent fonctionnels.

## Hors périmètre

- refonte des pages métier ;
- raccordement de l'utilisateur et des notifications ;
- permissions réelles de navigation ;
- remplacement de toutes les icônes internes aux pages ;
- tests visuels automatisés.
