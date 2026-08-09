# Changelog

## Lot 4.2 — remédiation audit, étape 1

- remplace les transformations SQL au démarrage API par deux migrations
  PostgreSQL versionnées ;
- archive les anciennes corrections de fuseau et fournit leur rollback ;
- impose l'exécution du service de migration avant l'API ;
- ajoute un test Docker isolé couvrant idempotence, rollback et redémarrages.

## Non publié — Intégration du Handbook et audit du Lot 4.2

- intégration de `PROJECT-HANDBOOK.md` comme source de vérité permanente ;
- séparation explicite entre le Lot 4.1 validé et le Lot 4.2 en développement ;
- audit des fonctionnalités existantes et correction de l'avancement à 60 % ;
- validation technique de l'étape documentaire : tests, builds Web/API et
  trois services Docker isolés sains ;
- aucune validation utilisateur du Lot 4.2 n'est revendiquée.
- réconciliation transactionnelle des valeurs fournisseur et overrides ;
- synchronisation non destructive, conflit explicite et résolutions testées
  sur PostgreSQL réel ;
- ajout du validateur `npm run validate:step2`.
- formulaire Événement limité aux données métier, sans Slug, Origine ni Fuseau
  horaire éditable ;
- génération serveur des slugs uniques, origine manuelle automatique et fuseau
  déduit du circuit avec repli UTC ;
- ingestion fournisseur isolée et ajout du validateur `npm run validate:step3`.
- normalisation de tous les événements en UTC sans gestion de fuseau ;
- pagination de la vue Liste par 25 et tri de l'événement le plus proche en
  premier.
- tri interactif des colonnes Date, Événement, Championnat, Circuit, Statut et
  API sur l'ensemble des pages.
- page Corrections complétée avec filtres combinés, modification locale,
  synthèse des résultats et ouverture directe de l'événement.
- générateur déterministe enrichi de 12 corrections couvrant les statuts,
  conflits, fournisseurs, champs, auteurs et dates nécessaires à la recette.
- édition locale typée dans Corrections : référentiels et énumérations en
  listes contrôlées, dates via calendrier et heure avec conversion UTC.
- pagination de Corrections par dix, libellés d'actions simplifiés et traduction
  de `postponed` en « Reporté ».
- suppression de l'action redondante « Supprimer correction » dans l'interface.
- étape 4 Corrections validée explicitement par l'utilisateur sur VPS isolé le
  3 août 2026.

## 8.1.0-alpha.2-lot.4.2 — 2026-08-01

### Calendrier interactif, corrections et données de test

- vues Mois, Semaine, Jour et Agenda avec navigation et filtres communs ;
- déplacement, redimensionnement accessible, création rapide, duplication,
  mutations optimistes avec rollback et avertissement de chevauchement ;
- corrections fournisseur champ par champ avec comparaison, conflit et actions
  de résolution, sans exposition des métadonnées dans l'API publique ;
- identité Motorsports Events locale, registre d'assets, codes pays accessibles
  et fallbacks documentés ;
- chaîne hybride sécurisée d'export, import isolé, anonymisation, vérification
  bloquante et génération déterministe de données réalistes ;
- tests unitaires, intégration PostgreSQL, Docker et captures Chromium étendus.
- ajout après recette VPS des drapeaux locaux AU, DE, ES, FR, GB, IT, JP et US ;
- remplacement du jeu limité par les 270 SVG locaux `flag-icons` 7.2.3 sous
  licence MIT, avec résolution automatique de tout code pays alpha-2 ;
- ajout d'une légende dynamique sous le calendrier mensuel, limitée aux
  championnats actuellement visibles et synchronisée avec les filtres existants ;
- navigation précédent/suivant adaptée à la vue active : mois, semaine, jour
  ou fenêtre Agenda de trente jours, avec libellé de période correspondant ;
- génération idempotente de 32 événements fournisseur synthétiques et
  validation de bout en bout de leur affichage dans la page Corrections ;
- remplacement des identifiants de champs, championnats, circuits et
  fournisseurs connus par des libellés lisibles dans la page Corrections ;
- ajout d'un filtre Fournisseur sur Événements et Corrections, et renommage des
  libellés visibles « Origine administrative » sans changement du contrat API ;
- normalisation des sources visibles en `OC BlackTop`, `TheSportsDB` et
  `Motorsports Events`, ce dernier couvrant les ajouts manuels ;
- découverte automatique des futures clés fournisseur et génération d'un
  libellé lisible dans les filtres Événements et Corrections ;
- affichage des logos configurés ou des identités sportives locales dans la
  page Championnats, avec fallback en cas d'asset absent ou invalide ;
- ajout d'identités sportives locales F1, MotoGP et WRC et priorité aux URLs de
  logos autorisées configurées dans l'administration.

## 8.1.0-alpha.2-lot.4-rev.1 — 2026-08-01

### Restauration du calendrier Événements

- calendrier mensuel rétabli comme vue par défaut ;
- vue Liste conservée avec le CRUD existant ;
- filtres et sélection partagés entre les deux vues ;
- panneau de détail avec modification, duplication et suppression ;
- création préparée depuis un jour du calendrier ;
- navigation clavier et attributs ARIA sur la bascule et les sélections ;
- tests unitaires des règles calendaires et tests Chromium des deux vues ;
- captures 1440×900 générées pour la validation utilisateur ;
- aucune modification du schéma PostgreSQL ou des contrats `/api/v1`.
- validation utilisateur réussie sur un environnement VPS Docker isolé ;
- API, PostgreSQL, interface, CRUD, publication et non-régression
  Championnats confirmés ;
- workflow Python historique limité aux changements de l'ancien serveur.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Lot 4 — Événements
- CRUD complet des événements ;
- rattachement aux championnats et circuits ;
- statuts, publication, dates et fuseau horaire ;
- API publique dédiée aux clients ;
- métadonnées d’origine réservées à l’administration ;
- écran MEDS desktop et filtres ;
- validation automatisée du lot 4.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correction renforcée des suppressions
- suppression explicite du header JSON côté frontend lorsqu’aucun corps n’est envoyé ;
- ajout d’une protection `onRequest` dans Fastify pour les requêtes vides ;
- prévention de la réutilisation d’un ancien `index.html` par le navigateur ;
- aucune modification du schéma de données ni des règles métier.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif de compilation du frontend
- réécriture complète de la fonction HTTP `request()` ;
- suppression des variables inexistantes `options` et `body` ;
- utilisation de `init.body` et de l’API native `Headers` ;
- ajout de `Content-Type: application/json` uniquement lorsqu’un corps existe ;
- correction complémentaire de l’encodage UTF-8 des scripts Windows.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif de suppression depuis l’interface
- correction du client HTTP partagé du frontend ;
- `Content-Type: application/json` n’est plus envoyé sans corps de requête ;
- suppression d’un championnat depuis l’interface désormais compatible avec Fastify ;
- aucune modification du modèle de données ni du périmètre fonctionnel du lot 3.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif DELETE du validateur
- l'en-tête `Content-Type: application/json` n'est ajouté que lorsqu'un corps est présent ;
- correction de `FST_ERR_CTP_EMPTY_JSON_BODY` lors de la suppression ;
- amélioration supplémentaire de l'encodage UTF-8 de `reset-dev` ;
- aucune modification du périmètre métier du lot 3.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif du validateur du lot 3
- correction des chaînes JavaScript contenant un retour à la ligne brut ;
- validation syntaxique de `scripts/validate-lot3.mjs` avant empaquetage ;
- amélioration de l'affichage UTF-8 sous Windows ;
- aucune modification du périmètre métier du lot 3.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Gestion des championnats
- CRUD API complet et validé par Zod ;
- écran fonctionnel de création, modification, activation et suppression ;
- paramètres facultatifs de synchronisation ;
- protection des championnats liés à des événements ;
- filtres et recherche ;
- script `test-lot3` sans avertissement Node `DEP0190`.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif des scripts Windows
- suppression du caractère `\` parasite placé avant `param(...)` ;
- réécriture propre de `cleanup.ps1` et `reset-dev.ps1` ;
- réécriture propre de `cleanup.cmd` et `reset-dev.cmd` ;
- contrôle des premières lignes avant création de l'archive ;
- conservation du correctif TypeScript `ReactNode`.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Correctif de compilation
- remplacement de `JSX.Element` par `ReactNode` dans le registre d'icônes MEDS ;
- compatibilité avec la configuration TypeScript/React du projet.

### Exploitation Docker
- ajout de `cleanup.ps1`, `cleanup.cmd` et `cleanup.sh` ;
- suppression ciblée des conteneurs et réseaux Motorsports Events ;
- suppression facultative et confirmée des volumes PostgreSQL ;
- suppression facultative et confirmée des images ;
- ajout de `reset-dev.ps1` et `reset-dev.cmd` ;
- commandes npm `cleanup`, `cleanup:all` et `reset`.

## 8.1.0-alpha.2-lot.4 — 2026-07-31

### Shell global MEDS
- extraction d'AppShell, Sidebar, Topbar et PageHeader ;
- navigation centralisée et typée ;
- remplacement des icônes de navigation par des SVG MEDS ;
- horloge réelle Europe/Paris ;
- navigation mobile avec fond occultant ;
- conservation des badges et routes existants.

### Exploitation locale
- ports Web et API configurables ;
- scripts `.cmd` compatibles Windows ;
- validation multiplateforme via Node.js ;
- scripts PowerShell indépendants du dossier courant.

### Métier
Aucun changement fonctionnel volontaire.
