# Handbook Changelog

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
