# Motorsports Events Server — Project Handbook
## Version 1.5

Ce document est la source de vérité permanente du projet.

## Hiérarchie documentaire

- `PROJECT-HANDBOOK.md` et `docs/handbook/` portent les règles permanentes ;
- `docs/handoff/` porte le périmètre, l'avancement et les critères du lot
  courant sans pouvoir contredire le Handbook ;
- `docs/handover/` et la documentation historique restent conservés comme
  preuves et contexte des lots terminés ;
- `PROJECT-STATUS.json` distingue l'état validé de l'état en développement ;
- `docs/handoff/PROGRESS.json` est le suivi canonique du lot courant.

Une règle spécifique à un lot ne devient permanente qu'après mise à jour du
Handbook, du journal des décisions, du changelog du Handbook et d'un ADR.

## Vision
Motorsports Events Server centralise les données de sports mécaniques pour l'administration web, l'API publique, le plugin MyBB, l'application mobile et les clients tiers.

## Architecture
Backend : Fastify, TypeScript, PostgreSQL, Docker.
Frontend : React, TypeScript, Vite.
API : REST JSON, versionnée, séparation stricte public/administration.

## Administration orientée métier
Les formulaires ne doivent pas exposer UUID, slug, origin, provider ID, external ID, timestamps internes ou métadonnées techniques.

### Slug
Généré automatiquement et rendu unique par le serveur. Jamais visible ni
modifiable dans les mutations administratives métier.

### Origine
Déterminée automatiquement : administration=manual, fournisseur=provider,
import=import. L'ingestion fournisseur utilise une entrée séparée des mutations
administratives ordinaires.

### Fuseau horaire
Non éditable et non administré. Les dates et le champ de compatibilité
`timezone` sont stockés exclusivement en UTC.

## Référentiels
Toute valeur connue utilise une liste prédéfinie : sports, championnats, pays, fuseaux, langues, catégories, statuts, fournisseurs, types de session, rôles.

## Événements manuels
Ils sont natifs au serveur. Leur modification est directe, ne crée aucune correction et n'apparaît jamais dans Corrections.

## Événements fournisseur
Une modification locale conserve la valeur fournisseur, crée un override, devient la valeur effective et ne peut pas être écrasée par une synchronisation.

La valeur source et l'override sont réconciliés dans une transaction. Une
synchronisation met à jour la source, conserve l'override et signale un conflit
si la source évolue. Un retour de la valeur locale à la source supprime
l'override actif.

## Page Corrections
Uniquement pour les données fournisseur. Affichage champ par champ : valeur fournisseur, valeur locale, auteur, date, statut, conflit et compteur de champs corrigés.

## Valeur effective
Override local s'il existe, sinon valeur fournisseur, sinon valeur manuelle native. L'API publique expose uniquement cette valeur.

## Calendrier
Vue principale avec Mois, Semaine, Jour, Agenda, glisser-déposer, redimensionnement, création rapide, duplication et rollback.

La vue Liste présente 25 événements par page et place en premier l'événement
dont le début est le plus proche de la date courante. Ses colonnes métier sont
triables sur l'ensemble des résultats, avant pagination : dates en ordre
chronologique croissant ou décroissant, textes en ordre alphabétique croissant
ou décroissant.

## Graphismes
Les maquettes sont un contrat. Logo officiel, logos championnats, drapeaux, logos circuits, fallbacks et fidélité cible >= 98 %.

## Données hybrides
Données sportives réalistes, identités synthétiques, secrets supprimés, intégrations neutralisées, aucun dump dans Git.

## Tests
Unitaires, intégration, API, Docker, UI, sécurité et non-régression. Une fusion dans main ne vaut pas validation utilisateur.

La validation utilisateur est explicite et consignée dans les fichiers d'état
avec sa date et son périmètre. Une CI verte, un build réussi, une fusion ou un
déploiement technique ne suffisent pas à déclarer un lot validé.

## Workflow Git
`main` reçoit uniquement des versions ayant déjà fait l'objet d'une validation
utilisateur explicite ; `develop` sert à l'intégration ; `codex/*` aux travaux
Codex ; `feature/*` aux fonctionnalités ; `release/*` à la préparation.
Fusionner une branche dans `main` ne constitue jamais, à lui seul, une
validation utilisateur.

## État
Lot 4.1 validé. Lot 4.2 en développement et non validé. Lot 4.3 non démarré.

## Règles Codex
Avant toute modification : lire ce Handbook, `CODEX.md`,
`PROJECT-STATUS.json`, `docs/handoff/PROGRESS.json`, tous les ADR du Handbook
et les spécifications du lot dans `docs/handoff/`.
