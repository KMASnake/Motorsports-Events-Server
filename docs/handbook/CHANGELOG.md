# Handbook Changelog

## 1.17 — 2026-08-10

- consigne la validation mainteneur des API Sessions administrative et publique
  sur VPS isolé ;
- fixe les routes publiques Sessions imbriquées par Événement et par
  identifiant ;
- limite la projection publique aux champs métier et aux Sessions publiées
  dont l'Événement parent est visible ;
- impose l'ordre stable `starts_at`, puis `id`, et des filtres publics stricts.

## 1.16 — 2026-08-10

- remplace le couple métier nom/type par un intitulé unique extensible ;
- ajoute les suggestions issues des données fournisseur et locales ;
- conserve le référentiel technique uniquement pour la compatibilité `0004` ;
- fixe les routes du CRUD administratif Sessions ;
- impose pagination, filtres et tri serveur sur la liste d'un événement ;
- limite cette étape aux créations humaines manuelles ;
- refuse les mutations silencieuses des Sessions fournisseur avant Corrections ;
- applique l'audit atomique prévu par l'ADR-0012.

## 1.15 — 2026-08-10

- définit le modèle relationnel et temporel des Sessions ;
- introduit un référentiel extensible de types de session ;
- impose l'atomicité entre mutation Session et audit ;
- sépare l'identité d'ingestion automatisée des administrateurs humains ;
- formalise la réversibilité de la migration Sessions ;
- consigne la validation explicite de l'ADR-0012 et du plan `0004_sessions` ;
- consigne la validation VPS explicite de l'étape migration, sans déclarer le
  Lot 4.3 complet validé.

## 1.14 — 2026-08-09

- précise la création d'événement par plage ;
- impose le rollback visuel des mutations optimistes refusées ;
- rend le calcul de durée indépendant de minuit et des changements d'heure.

## 1.13 — 2026-08-09

- impose pagination, filtres et tris serveur validés pour l'administration ;
- impose un journal de mutation avec acteur, avant/après et requête ;
- rend unique l'identité fournisseur d'un événement.

## 1.12 — 2026-08-09

- protège uniformément toutes les routes `/api/v1/admin/` ;
- impose des jetons Bearer signés, expirants et dotés d'un rôle ;
- interdit d'intégrer le secret ou un jeton au bundle Web.

## 1.11 — 2026-08-09

- impose des migrations PostgreSQL versionnées avant le démarrage API ;
- interdit toute transformation de données métier au démarrage ;
- exige un rollback et l'archivage restaurable des données incompatibles.

## 1.10 — 2026-08-03

- retire de l'interface l'action redondante « Supprimer correction » ;
- conserve « Restaurer fournisseur » comme seule suppression visible d'un
  override.

## 1.9 — 2026-08-03

- limite Corrections à dix lignes par page avec navigation ;
- simplifie et renomme les actions de résolution visibles ;
- impose la traduction française des statuts fournisseur.

## 1.8 — 2026-08-03

- impose des éditeurs de correction adaptés au type métier ;
- remplace le texte libre par des listes pour les référentiels et énumérations ;
- impose un contrôle date et heure avec persistance UTC.

## 1.7 — 2026-08-03

- impose un jeu de données de recette adapté à chaque nouvelle version ;
- exige une génération reproductible, idempotente et sans donnée sensible ;
- rend obligatoires les commandes d'injection et résultats attendus.

## 1.6 — 2026-08-03

- complète les filtres permanents de la page Corrections ;
- formalise la modification d'override et la navigation vers l'événement.

## 1.5 — 2026-08-03

- rend les colonnes de la liste Événements triables ;
- précise que le tri précède la pagination ;
- conserve la proximité temporelle comme ordre initial.

## 1.4 — 2026-08-03

- remplace la déduction des fuseaux par un stockage UTC uniforme ;
- fixe la pagination de la liste Événements à 25 lignes ;
- définit le tri par proximité avec la date courante.

## 1.3 — 2026-08-03

- précise la génération serveur des slugs et origines ;
- isole l'ingestion fournisseur des mutations administratives métier ;
- fixe UTC comme repli déterministe lorsque le fuseau ne peut pas être déduit.

## 1.0 — 2026-08-02
Création du Handbook et formalisation des règles permanentes du projet.

## 1.1 — 2026-08-02

- intégration du Handbook dans l'ordre de lecture officiel du dépôt ;
- formalisation de la hiérarchie entre Handbook, handoff courant et historique ;
- distinction explicite entre Lot 4.1 validé et Lot 4.2 en développement ;
- rappel qu'une fusion dans `main` ne vaut pas validation utilisateur.

## 1.2 — 2026-08-03

- formalisation de la réconciliation transactionnelle source/override ;
- protection des overrides pendant une synchronisation fournisseur ;
- suppression d'un override redevenu identique à la source ;
- refus d'une synchronisation fournisseur sur un événement manuel.
