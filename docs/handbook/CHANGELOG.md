# Handbook Changelog

## 1.25 — 2026-08-12

- ajoute la découverte réelle OCBlackTop et TheSportsDB sans ingestion d’événements ;
- persiste les découvertes, divergences, absences et historiques séparément des liens validés ;
- impose association, création locale et adoption de configuration comme actions explicites et auditées ;
- conserve le scheduler, la synchronisation et le moteur complet de quotas hors du Lot 5.3.
- corrige l’audit 5.3 : catalogue OCBlackTop déclaratif, complétude explicite,
  quota inconnu bloquant, comptage des erreurs et revalidation à l’adoption.
- complète le Lot 5.3 avec la configuration manuelle de sources indépendante
  de la découverte, inactive par défaut et sans synchronisation d’événements.

## 1.24 — 2026-08-12

- consigne la validation explicite du Lot 4.4 sur Windows et VPS ;
- sécurise la recette Windows en bootstrapant le compte dans l'API déjà
  démarrée, sans réexécuter le service de migration ;
- applique le même bootstrap et la même origine `127.0.0.1` à la CI Chromium ;
- aligne les URL locales sur `127.0.0.1` et la version affichée par l'API et
  l'interface sur `8.1.0-alpha.2-lot.4.4` ;
- conserve la CI verte sur le SHA final comme prérequis de fusion.

## 1.23 — 2026-08-12

- prépare le Lot 4.4 comme candidat de validation finale ;
- ajoute les recettes finales Windows et VPS pour l'authentification ;
- rappelle que la CI et la fusion ne valent pas validation mainteneur.

## 1.22 — 2026-08-11

- clôt le Lot 4 fonctionnel et retire la duplication du périmètre futur ;
- consigne les décisions fonctionnelles d'authentification humaine du Lot 4.4 ;
- propose Argon2id, sessions PostgreSQL opaques et CSRF signé lié à la session ;
- conserve le HMAC comme mécanisme technique séparé ;
- ajoute l'ADR-0014 et le plan proposé de migration `0006`.
- consigne la validation explicite de la Phase 0 et accepte l'ADR-0014 ;
- autorise le démarrage ultérieur de l'implémentation, encore à 0 %.
- implémente l'étape 1 : migration `0006`, Argon2id et bootstrap/récupération
  du compte administrateur singleton, sans route ni interface de connexion.
- consigne la réussite de la recette Docker VPS et la validation explicite de
  l'étape 1 par le mainteneur.
- implémente l'étape 2 API : login/session/logout, sessions PostgreSQL opaques,
  expirations, anti-bruteforce, CSRF, audit et coexistence HMAC.
- consigne la réussite de la recette API Docker VPS et la validation explicite
  de l'étape 2 par le mainteneur.
- implémente l'étape 3 Web : `/login`, restauration de session, navigation
  protégée, client cookie/CSRF et déconnexion sans stockage de jeton JavaScript.
- migre les recettes Chromium historiques vers la connexion humaine.
- consigne la réussite de la recette Chromium VPS et la validation explicite
  de l'étape 3 par le mainteneur.

## 1.21 — 2026-08-11

- consigne la validation utilisateur explicite du Lot 4.3 ;
- rattache cette validation aux preuves VPS isolées et à la recette Windows
  complète réussie avec 11 scénarios Chromium ;
- autorise la préparation de la fusion sans confondre fusion et validation.

## 1.20 — 2026-08-11

- remplace le modèle UI multi-sessions par « un Événement = une Session » ;
- ajoute l'intitulé de session directement à l'Événement ;
- conserve une combobox créable alimentée par tous les fournisseurs et les
  valeurs déjà enregistrées, sans distinction d'origine visible ;
- conserve `0004_sessions` et ses routes comme compatibilité transitoire ;
- implémente la migration réversible `0005_event_session_title`, le contrat
  Événement et la combobox cible.

## 1.19 — 2026-08-11

- consigne l'implémentation de la gestion Sessions dans la fiche Événement ;
- confirme l'intitulé unique sous forme de combobox éditable/créable ;
- confirme que les Sessions fournisseur passent par Corrections ;
- conserve l'interface comme candidat technique avant audit et recettes finales.

## 1.18 — 2026-08-10

- fixe les six champs corrigibles d'une Session et leur validation typée ;
- impose la synchronisation fournisseur non destructive et la convergence ;
- sérialise résolutions, overrides et synchronisations par Session ;
- impose un audit atomique unique et une projection publique effective ;
- enrichit les suggestions d'intitulés avec source et override.

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
