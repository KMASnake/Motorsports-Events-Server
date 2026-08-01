# Changelog

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
