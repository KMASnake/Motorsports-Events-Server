# Rapport d'implémentation — Lot 4.2

> **Statut historique antérieur à l'audit du 2026-08-02.** Ce rapport décrit
> l'intention et les validations techniques de la première candidate ; il ne
> constitue pas une validation utilisateur et certaines affirmations restent à
> consolider. `PROJECT-STATUS.json` et `docs/handoff/PROGRESS.json` portent
> l'état canonique actuel : Lot 4.2 en développement, avancement audité à 60 %.

Date : 2026-08-01

Branche : `codex/lot-4.2-complete`

Version candidate : `8.1.0-alpha.2-lot.4.2`

## Étape 2 — Réconciliation fournisseur transactionnelle

Le 2026-08-03, la gestion des corrections a été centralisée dans un service
transactionnel. Une deuxième édition locale conserve désormais la véritable
valeur fournisseur. Une synchronisation actualise cette source sans écraser
l'override, crée un conflit si nécessaire et supprime la correction lorsque la
source et la valeur locale convergent.

Le validateur `npm run validate:step2` couvre une base PostgreSQL réelle :
événement manuel sans correction, deux éditions locales, synchronisation sous
override, résolution locale, résolution fournisseur, retour à la source et
nettoyage de l'API publique.

La recette VPS isolée de l'étape 2 a été confirmée par le mainteneur le
2026-08-03 après génération des données et contrôle du parcours Corrections.
Cette confirmation ne valide pas le Lot 4.2 complet.

## Étape 3 — Administration orientée métier

Le formulaire Événement ne présente plus le slug, l'origine, le fuseau
éditable ni l'identité fournisseur. Les mutations administratives ordinaires
refusent ces métadonnées : le serveur génère un slug unique, impose l'origine
`manual` et déduit le fuseau du circuit, avec repli UTC sans localisation.

L'ingestion fournisseur est isolée dans
`POST /api/v1/admin/provider-events`, génère l'origine `provider` et conserve
la priorité du fuseau source. La duplication utilise la création métier et
obtient donc sa propre identité technique.

Le validateur `npm run validate:step3` couvre ces règles sur PostgreSQL réel.
Les validateurs des étapes 2 et du Lot 4 restent verts, tout comme les sept
scénarios Chromium exécutés dans l'image Playwright officielle.

La recette VPS de l'étape 3 a été confirmée par le mainteneur le 2026-08-03.
À sa demande, la déduction de fuseau a ensuite été remplacée par un stockage
UTC uniforme : les lignes historiques sont normalisées au démarrage et les
corrections de fuseau devenues sans objet sont supprimées.

La vue Liste affiche désormais 25 événements par page. Son ordre par défaut
place en tête l'événement dont la date de début est la plus proche de l'instant
courant. Sur le jeu déterministe de recette, 98 événements sur 98 sont stockés
en UTC et les sept scénarios Chromium, dont le contrôle des 25 lignes et du
premier événement, réussissent.

Les en-têtes Date, Événement, Championnat, Circuit, Statut et API sont ensuite
devenus triables. Le tri concerne les données filtrées complètes avant leur
découpage en pages. La date alterne entre chronologie croissante et
décroissante ; les autres colonnes alternent entre ordre alphabétique croissant
et décroissant. La recette Chromium contrôle l'ordre initial, les deux sens de
date et le tri alphabétique.

## Étape 4 — Exploitation des corrections

Le générateur synthétique crée désormais 12 corrections persistantes et
idempotentes. Le jeu couvre les statuts actif, conflit, résolu et ignoré, les
fournisseurs OC BlackTop, TheSportsDB et une future source synthétique, ainsi
que plusieurs champs, auteurs et anciennetés. Il permet de vérifier tous les
filtres sans dépendre d'une synchronisation ou de données de production.

L'édition locale propose les championnats, circuits, statuts et états de
publication sous forme de listes contrôlées. Les champs de début et fin
utilisent un contrôle date et heure natif, converti en UTC avant enregistrement.

La page Corrections propose désormais des filtres combinables par recherche,
championnat, fournisseur, champ, statut, conflit, auteur, période et nombre de
champs corrigés. Un résumé indique le nombre d'événements et de champs visibles.

Chaque override peut être modifié en ligne, conservé, remplacé par la valeur
fournisseur ou supprimé. Le bouton Ouvrir l'événement conduit à la page
Événements avec le bon panneau de détail sélectionné. Deux tests unitaires
couvrent les combinaisons de filtres et la recette Chromium couvre édition,
réinitialisation, libellés métier et navigation.

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
- validation VPS graphique du 2026-08-01 : l'utilisateur confirme que les
  identités sportives et les drapeaux des pays sont visibles dans l'interface ;
- jeu complet : 270 drapeaux/territoires `flag-icons` 7.2.3 sous licence MIT,
  résolution dynamique sans whitelist et contrôles directs de BR, ZA, NZ et MX ;
- revalidation du jeu complet : 17 tests unitaires, builds Web/API, Docker et
  5 scénarios Chromium réussis ;
- légende calendrier : couleurs et identités des championnats visibles sous la
  grille mensuelle, synchronisées avec le panneau de filtres existant ;
- revalidation légende : 17 tests unitaires, builds Web/API, Docker et 5
  scénarios Chromium réussis ;
- navigation contextuelle : les flèches utilisent un pas d'un jour en vue Jour,
  de sept jours en vue Semaine, de trente jours en vue Agenda et d'un mois en
  vues Mois/Liste ;
- revalidation navigation : 19 tests unitaires, builds Web/API, 3 services
  Docker sains et 6 scénarios Chromium réussis ;
- recette Corrections : le générateur produit 32 événements fournisseur sur
  96 et met à niveau les lignes d'un jeu déjà présent sans écraser leur contenu ;
- validation de bout en bout : modification d'un événement fournisseur,
  création de l'override, lecture API, affichage Web et nettoyage réussis ;
- lisibilité Corrections : les champs, championnats, circuits et fournisseurs
  connus sont présentés avec leurs noms, sans exposer les identifiants comme
  libellés principaux ;
- filtres Fournisseur : Événements filtre les modes Manuel, Synchronisé et
  Hybride ; Corrections filtre les fournisseurs effectivement présents ;
- le libellé visible « Origine administrative » devient « Fournisseur » sans
  renommer les valeurs ni les champs du contrat API ;
- les sélecteurs Fournisseur présentent `OC BlackTop`, `TheSportsDB` et
  `Motorsports Events` ; les ajouts manuels utilisent ce dernier libellé ;
- toute future clé fournisseur reçue de l'API est ajoutée automatiquement aux
  filtres avec un libellé dérivé lisible, sans liste applicative fermée ;
- Championnats : la liste affiche la même identité sportive que le calendrier,
  en privilégiant l'URL autorisée configurée puis l'asset local et le fallback ;
- revalidation Championnats : image réellement chargée contrôlée dans Docker
  et sept scénarios Chromium réussis ;
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
