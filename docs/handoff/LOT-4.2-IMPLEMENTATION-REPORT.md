# Rapport d'implémentation — Lot 4.2

Date : 2026-08-01

Branche : `codex/lot-4.2-complete`

Version candidate : `8.1.0-alpha.2-lot.4.2`

## Résultat

Le calendrier propose les vues Mois, Semaine, Jour et Agenda. Les événements
peuvent être créés rapidement, dupliqués, déplacés et prolongés. Les mutations
sont optimistes et restaurent l'état précédent si l'API refuse l'opération. Un
chevauchement simple entre événements publiés sur un même circuit est signalé.

Les modifications d'un événement fournisseur créent une correction locale par
champ. La valeur fournisseur et la valeur locale sont conservées séparément.
La page Corrections les regroupe par événement et permet d'accepter la valeur
fournisseur, conserver l'override ou le supprimer. Un événement manuel ne crée
aucune correction. L'API publique ne retourne que la valeur effective.

## Architecture

- `event_corrections` conserve les valeurs et états par champ ;
- l'API admin orchestre la création et la résolution des corrections ;
- le calendrier consomme uniquement les valeurs effectives des événements ;
- les assets passent par un registre local avec fallback ;
- les snapshots de production restent hors Git et ne sont importés que dans
  une base temporaire explicitement autorisée.

## Assets

- logo Motorsports Events : création originale locale ;
- fallback championnat/circuit : création originale locale ;
- pays : code ISO accessible, sans service distant ;
- logos tiers : aucun fichier sans droit de redistribution n'est inclus.
- correction post-recette : huit drapeaux SVG locaux et trois badges sport
  originaux sont affichés dans le calendrier ; une `logo_url` autorisée
  configurée par l'administrateur prend automatiquement la priorité.

La provenance et les règles de remplacement sont détaillées dans
`docs/assets/ASSET-SOURCES.md`.

## Données hybrides

Les données sportives non personnelles sont conservées. Les identités,
sessions, secrets, intégrations et journaux sensibles sont supprimés ou
remplacés. La vérification est bloquante. Le générateur `acceptance` a produit
deux fois de façon idempotente 12 championnats, 40 circuits et 96 événements.

Voir `docs/data/SANITIZATION-POLICY.md` et
`docs/data/SECURITY-CHECKLIST.md`.

## Validation locale

- TypeScript : réussi ;
- tests unitaires web/API : 12 réussis ;
- Docker Compose isolé : PostgreSQL, API et Web sains ;
- intégration corrections : override fournisseur créé, événement manuel exclu,
  métadonnées absentes de l'API publique ;
- Chromium Playwright : 5 scénarios réussis, dont un contrôle 1280 × 720 ;
- revalidation graphique : builds Web/API, Docker et Chromium réussis après
  ajout des drapeaux et badges sport ;
- captures 1440 × 900 : Mois, Semaine, Jour, Agenda, glisser-déposer,
  avertissement, Corrections et identité.

## Écarts et décisions explicites

- la validation VPS et la recette manuelle Windows restent à réaliser par le
  mainteneur avant fusion ;
- les logos officiels tiers seront ajoutés seulement après obtention et
  documentation d'un droit de redistribution ; les fallbacks sont actifs ;
- l'alerte `npm audit` React Router vise les fonctions RSC/Server Actions, non
  utilisées par cette SPA ; une migration majeure hors lot n'est pas engagée ;
- la baseline ne possède pas de configuration ESLint 9.

## Recette Windows

```powershell
git switch codex/lot-4.2-complete
npm ci
docker compose up --build -d
npm run typecheck
npm test
npx playwright test
```

Vérifier ensuite `http://localhost:3000/events` et
`http://localhost:3000/corrections`, puis tester chaque vue, un déplacement,
un redimensionnement, une duplication et les deux choix de résolution.
