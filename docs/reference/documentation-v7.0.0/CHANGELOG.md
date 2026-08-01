# Changelog

## 6.1.4 — 2026-07-31
- Finalisation responsive.
- Spécification WCAG 2.2 AA.
- Ajout des états globaux.
- Ajout des données de démonstration.
- Ajout des tests Playwright et Axe.
- Préparation frontend Codex portée à 100 %.

# Changelog

## 6.1.3 — 2026-07-31
- Ajout des quatre écrans d’administration.
- Ajout des PNG 1536×1024, prototype, spécifications et tests.
- Préparation frontend estimée à 91 %.

# Changelog

## 6.1.2 — 2026-07-31
- Ajout des écrans Circuits, API, Observabilité et Journaux.
- Ajout de quatre références PNG 1536×1024 réellement générées.
- Ajout du prototype navigable et des contrats frontend.
- Ajout des critères d’acceptation et du guide Codex.

# Changelog

## 6.1.1 Enterprise — UI Manual Wizard
- Ajout des mesures pixel-perfect du layout et des composants.
- Ajout des tokens CSS et JSON officiels.
- Normalisation des états interactifs, chargement, erreur, vide et permissions.
- Ajout des sept maquettes de l’assistant de création manuelle.
- Ajout d’un prototype HTML/CSS/JavaScript navigable.
- Spécification des validations, de la persistance du brouillon et de la publication atomique.
- Ajout des tests d’acceptation destinés à Codex.
- Préparation frontend portée de 73 % à 78 %.

## 6.1 Enterprise
- Consolidation complète de la documentation v5.8 dans une référence unique.
- Introduction de l'entité `Discipline`.
- Référentiel initial : Automobile, Moto, Karting, Camion, Drift, Rallye Raid, Motocross, Speedway.
- Introduction de l'entité `Category`, facultative sous un championnat.
- Une saison conserve un `championship_id` obligatoire et un `category_id` nullable.
- Ajout de la contrainte d'appartenance : la catégorie sélectionnée doit appartenir au championnat de la saison.
- Remplacement du terme technique `Round` par `Event` ; libellé fonctionnel français : « Épreuve ».
- Ajout du CRUD manuel Discipline → Championnat → Catégorie → Saison → Épreuve → Session.
- Ajout du rattachement ultérieur de données manuelles à un fournisseur.
- Mise à jour du modèle de données, de l'ERD, des API, de la synchronisation et des corrections.
- Mise à jour des écrans Dashboard, Événements, Détail événement, Championnats, Fournisseurs,
  Synchronisations, Corrections et Création manuelle.
- Ajout des ADR-024 à ADR-027 et du guide de migration v6.1.
- Remplacement des storyboards antérieurs par le storyboard v6.1.
- Validation documentaire automatique et manifeste SHA-256.

## 5.8
- Ajout du manuel final d'implémentation Codex.
- Ajout de la roadmap de réalisation intégrale.
- Ajout de l'ordre recommandé des modules et dépendances.
- Ajout des conventions de code et d'architecture.
- Ajout des standards Git, branches, commits et releases.
- Ajout du pipeline CI/CD de référence.
- Ajout de la Definition of Done.
- Ajout des checklists de revue de code et livraison.
- Ajout des guides de contribution, maintenance et exploitation.
- Ajout du manuel de migration et de mise en production.
- Ajout de l'index documentaire global et du glossaire.
- Ajout des ADR finales.
- Mise à jour de la complétude Codex à 100 %.


## 5.7
- Ajout de la stratégie de recette fonctionnelle.
- Ajout des parcours end-to-end prioritaires.
- Ajout de la matrice de traçabilité exigences ↔ tests.
- Ajout des tests de non-régression.
- Ajout des tests de performance, charge et endurance.
- Ajout des tests de résilience et reprise après panne.
- Ajout des critères d'acceptation utilisateur.
- Ajout des jeux de données de test et règles d'anonymisation.
- Ajout des environnements, responsabilités et preuves attendues.
- Ajout des critères d'entrée et de sortie de recette.
- Ajout des anomalies, sévérités et processus de décision.
- Ajout du guide Codex v5.7.
- Mise à jour de la complétude Codex à 97 %.


## 5.6
- Architecture de sécurité, authentification, autorisation et matrice de permissions.
- Gestion des secrets, rotation et chiffrement.
- Sécurité API, réseau, base, workers et conteneurs.
- Protections OWASP, SSRF, webhooks et validation stricte.
- Sauvegarde, reprise, réponse aux incidents et RGPD.
- Tests d’acceptation, ADR et guide Codex v5.6.
- Complétude Codex portée à 94 %.


## 5.5
- Ajout de l'architecture du moteur de correction.
- Définition du cycle de vie des corrections.
- Ajout des règles d'override au niveau du champ.
- Ajout du workflow de soumission, validation, activation et révocation.
- Ajout de la réversion manuelle et automatique assistée.
- Ajout des politiques de priorité entre fournisseur, valeur canonique et correction.
- Ajout de la détection des corrections devenues inutiles.
- Ajout de l'audit, de l'historisation et de la concurrence optimiste.
- Ajout des permissions liées aux corrections.
- Ajout des scénarios d'erreur et critères d'acceptation.
- Ajout du guide Codex v5.5.
- Mise à jour de la complétude Codex à 92 %.


## 5.4
- Ajout de l'architecture du moteur de synchronisation.
- Définition du pipeline collecte → validation → normalisation → matching → fusion → publication.
- Ajout des règles d'idempotence, verrouillage et concurrence.
- Ajout de la gestion de pagination, curseurs et reprise.
- Ajout du rate limiting et du backoff.
- Ajout des règles de détection des changements.
- Ajout du matching, des conflits et de la fusion canonique.
- Ajout de l'observabilité, métriques et journaux.
- Ajout des scénarios d'échec et plans de reprise.
- Ajout des tests d'acceptation de synchronisation.
- Ajout du guide Codex v5.4.
- Mise à jour de la complétude Codex à 89 %.


## 5.3
- Ajout des conventions REST et JSON.
- Ajout d'une spécification OpenAPI 3.1 de référence.
- Définition des endpoints publics et administratifs.
- Définition de la pagination, du tri et des filtres.
- Ajout du format d'erreur normalisé.
- Ajout des règles de versionnement et d'idempotence.
- Ajout des webhooks et de leur sécurité.
- Ajout des critères d'acceptation API.
- Ajout du guide Codex API.
- Mise à jour de la complétude Codex à 84 %.


## 5.2
- Ajout du modèle de données logique.
- Ajout du dictionnaire de données.
- Définition des clés, relations et contraintes.
- Définition des index fonctionnels.
- Ajout de la stratégie de migration et d'historisation.
- Ajout des règles de suppression, archivage et rétention.
- Ajout d'un ERD Mermaid.
- Mise à jour du rapport de complétude Codex à 78 %.


## 5.1
- Fusion des archives v4, v4.1, v4.2 et v4.3.
- Ajout de la vision métier.
- Ajout du glossaire contrôlé.
- Définition des contextes métier.
- Documentation des principales entités et agrégats.
- Définition des événements et services de domaine.
- Ajout des règles métier initiales.
- Ajout du guide de démarrage Codex.
- Ajout d'un rapport de complétude mesurable.
