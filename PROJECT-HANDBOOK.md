# Motorsports Events Server — Project Handbook
## Version 1.0

Ce document est la source de vérité permanente du projet.

## Vision
Motorsports Events Server centralise les données de sports mécaniques pour l'administration web, l'API publique, le plugin MyBB, l'application mobile et les clients tiers.

## Architecture
Backend : Fastify, TypeScript, PostgreSQL, Docker.
Frontend : React, TypeScript, Vite.
API : REST JSON, versionnée, séparation stricte public/administration.

## Administration orientée métier
Les formulaires ne doivent pas exposer UUID, slug, origin, provider ID, external ID, timestamps internes ou métadonnées techniques.

### Slug
Généré automatiquement si nécessaire. Jamais visible ni modifiable.

### Origine
Déterminée automatiquement : administration=manual, fournisseur=provider, import=import.

### Fuseau horaire
Non éditable. Déduit dans l'ordre : fournisseur, circuit, ville, pays. Affichable en lecture seule.

## Référentiels
Toute valeur connue utilise une liste prédéfinie : sports, championnats, pays, fuseaux, langues, catégories, statuts, fournisseurs, types de session, rôles.

## Événements manuels
Ils sont natifs au serveur. Leur modification est directe, ne crée aucune correction et n'apparaît jamais dans Corrections.

## Événements fournisseur
Une modification locale conserve la valeur fournisseur, crée un override, devient la valeur effective et ne peut pas être écrasée par une synchronisation.

## Page Corrections
Uniquement pour les données fournisseur. Affichage champ par champ : valeur fournisseur, valeur locale, auteur, date, statut, conflit et compteur de champs corrigés.

## Valeur effective
Override local s'il existe, sinon valeur fournisseur, sinon valeur manuelle native. L'API publique expose uniquement cette valeur.

## Calendrier
Vue principale avec Mois, Semaine, Jour, Agenda, glisser-déposer, redimensionnement, création rapide, duplication et rollback.

## Graphismes
Les maquettes sont un contrat. Logo officiel, logos championnats, drapeaux, logos circuits, fallbacks et fidélité cible >= 98 %.

## Données hybrides
Données sportives réalistes, identités synthétiques, secrets supprimés, intégrations neutralisées, aucun dump dans Git.

## Tests
Unitaires, intégration, API, Docker, UI, sécurité et non-régression. Une fusion dans main ne vaut pas validation utilisateur.

## Workflow Git
main = validé ; develop = intégration ; codex/* = travaux Codex ; feature/* = fonctionnalités ; release/* = préparation.

## État
Lot 4.1 validé. Lot 4.2 en développement et non validé. Lot 4.3 non démarré.

## Règles Codex
Avant toute modification : lire ce Handbook, CODEX.md, PROJECT-STATUS.json, PROGRESS.json, les ADR et les spécifications du lot.
