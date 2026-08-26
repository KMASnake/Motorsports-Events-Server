# Motorsports Events Server — Project Handbook
## Version 1.40

Ce document est la source de vérité permanente du projet.

## Hiérarchie documentaire

- `PROJECT-HANDBOOK.md` et `docs/handbook/` portent les règles permanentes ;
- `docs/handoff/PROGRESS.json` est l'unique source canonique de l'état courant : lot/gate actif, avancement, validations, autorisations, interdictions et prochaine action ;
- les autres documents de `docs/handoff/` portent les contrats, critères et preuves du périmètre actif sans pouvoir contredire le Handbook ni redéfinir l'état courant ;
- `docs/handbook/roadmap/ROADMAP.md` décrit uniquement la trajectoire fonctionnelle et ne définit aucun état d'exécution ;
- `PROJECT_STATUS.md`, `PROJECT-STATUS.json` et `NEXT_STEPS.md` sont uniquement des pointeurs de compatibilité et ne doivent contenir aucune vérité d'état indépendante ;
- `docs/handover/` et `docs/archive/` conservent les preuves et le contexte historiques et ne définissent jamais l'état courant.

En cas de divergence sur l'état d'exécution, `docs/handoff/PROGRESS.json` prévaut. En cas de divergence sur une règle permanente, le Handbook et les ADR applicables prévalent.

Une règle spécifique à un lot ne devient permanente qu'après mise à jour du Handbook, du journal des décisions, du changelog du Handbook et d'un ADR.

## Vision
Motorsports Events Server centralise les données de sports mécaniques pour l'administration web, l'API publique, le plugin MyBB, l'application mobile et les clients tiers.

## Architecture
Backend : Fastify, TypeScript, PostgreSQL, Docker.
Frontend : React, TypeScript, Vite.
API : REST JSON, versionnée, séparation stricte public/administration.

Toutes les routes `/api/v1/admin/` exigent un jeton Bearer signé, non expiré et portant le rôle administrateur. Le secret de signature reste côté serveur et aucun jeton n'est embarqué dans le bundle Web. Voir `docs/handbook/architecture/ADR-0010-ADMIN-API-AUTHORIZATION.md`.
Les mutations historiques de championnats suivent la même protection tandis que leur lecture reste publique.

### Authentification humaine de la console

Le Lot 4.4 prépare une connexion humaine distincte du HMAC technique : compte administrateur unique, mot de passe Argon2id, session opaque côté serveur dans PostgreSQL et cookie HttpOnly. Les décisions fonctionnelles et l'architecture détaillée de l'ADR-0014 ont été validées par le mainteneur le 2026-08-11.

La session expire après une heure d'inactivité et au plus tard après huit heures. Le logout révoque côté serveur. Les mutations par cookie utilisent une protection CSRF dédiée ; SameSite n'est jamais l'unique protection. Aucun mot de passe, hash, cookie, token de session ou secret HMAC n'est exposé au Web, aux logs ou à l'audit.

Les listes administratives sont paginées côté serveur après validation, filtrage et tri. Toute mutation sensible est journalisée avec son acteur, son identifiant de requête et ses valeurs avant/après, sans secret. Voir `docs/handbook/architecture/ADR-0011-ADMIN-PAGINATION-AND-AUDIT.md`.

Les corrections Sessions portent uniquement sur `title`, `starts_at`, `ends_at`, `status`, `published` et `description`. Elles séparent valeur fournisseur, override et valeur effective. Une synchronisation ne détruit pas un override ; toute mutation et son audit sont atomiques et sérialisés au niveau de la Session. L'API publique ne présente que la valeur effective. Voir `docs/handbook/architecture/ADR-0012-SESSIONS-MODEL.md`.

Toute évolution du schéma ou transformation de données utilise une migration versionnée exécutée avant l'API. Le démarrage applicatif vérifie le schéma en lecture seule et ne supprime ni ne réécrit aucune donnée métier. Voir `docs/handbook/architecture/ADR-0009-VERSIONED-DATABASE-MIGRATIONS.md`.

## Administration orientée métier
Les formulaires ne doivent pas exposer UUID, slug, origin, provider ID, external ID, timestamps internes ou métadonnées techniques.

### Slug
Généré automatiquement et rendu unique par le serveur. Jamais visible ni modifiable dans les mutations administratives métier.

### Origine
Déterminée automatiquement : administration=manual, fournisseur=provider, import=import. L'ingestion fournisseur utilise une entrée séparée des mutations administratives ordinaires.

### Fuseau horaire
Non éditable et non administré. Les dates et le champ de compatibilité `timezone` sont stockés exclusivement en UTC.

## Référentiels
Toute valeur connue utilise une liste prédéfinie : sports, championnats, pays, fuseaux, langues, catégories, statuts, fournisseurs, types de session, rôles.

## Événements manuels
Ils sont natifs au serveur. Leur modification est directe, ne crée aucune correction et n'apparaît jamais dans Corrections.

## Événements fournisseur
Une modification locale conserve la valeur fournisseur, crée un override, devient la valeur effective et ne peut pas être écrasée par une synchronisation.

La valeur source et l'override sont réconciliés dans une transaction. Une synchronisation met à jour la source, conserve l'override et signale un conflit si la source évolue. Un retour de la valeur locale à la source supprime l'override actif.

## Page Corrections
Uniquement pour les données fournisseur. Affichage champ par champ : valeur fournisseur, valeur locale, auteur, date, statut, conflit et compteur de champs corrigés.

Les filtres couvrent événement, championnat, fournisseur, champ, statut, conflit, auteur, période et nombre de champs. Chaque groupe permet d'ouvrir l'événement concerné et chaque override reste modifiable ou résoluble.

La modification locale respecte le type métier du champ : championnat, circuit, statut et publication utilisent des listes prédéfinies ; les dates utilisent un contrôle calendrier avec heure et sont enregistrées en UTC. Seuls les champs textuels libres conservent une saisie textuelle.

La page affiche au maximum dix corrections par page et utilise une navigation précédente/suivante. Les seules actions visibles sont « Modifier local » et « Restaurer fournisseur » ; conserver la valeur locale ne nécessite aucune action supplémentaire. Les statuts métier sont toujours traduits dans l'interface, notamment `postponed` en « Reporté ».

## Valeur effective
Override local s'il existe, sinon valeur fournisseur, sinon valeur manuelle native. L'API publique expose uniquement cette valeur.

## Événement et intitulé de session

Un Événement représente directement une Session métier. Il n'existe pas de collection de Sessions dans le workflow officiel et l'interface ne propose jamais plusieurs Sessions sous un Événement.

L'Événement conserve ses champs métier et possède un `session_title` facultatif. L'utilisateur le manipule dans une combobox éditable et créable : les suggestions agrègent les valeurs découvertes chez tous les fournisseurs et les valeurs déjà enregistrées, sans afficher leur origine. Une valeur inédite peut être saisie immédiatement et devient ensuite réutilisable.

Les tables, routes et corrections Sessions introduites avec `0004_sessions` restent temporairement disponibles pour compatibilité, mais ne constituent plus le modèle principal ni l'interface cible. Toute suppression ultérieure fera l'objet d'une décision et d'une migration séparées.

Le stockage temporel, le statut, la publication et la description sont ceux de l'Événement. Les métadonnées fournisseur restent techniques et l'API publique n'expose que la valeur effective. Voir `docs/handbook/architecture/ADR-0013-EVENT-AS-SESSION.md`.

## Calendrier
Vue principale avec Mois, Semaine, Jour, Agenda, glisser-déposer, redimensionnement, création rapide ou par plage, duplication et rollback. Une mutation optimiste refusée restaure l'état affiché. Les durées reposent sur les instants UTC et restent stables à minuit et lors des changements d'heure.

La vue Liste présente 25 événements par page et place en premier l'événement dont le début est le plus proche de la date courante. Ses colonnes métier sont triables sur l'ensemble des résultats, avant pagination : dates en ordre chronologique croissant ou décroissant, textes en ordre alphabétique croissant ou décroissant.

## Graphismes
Les maquettes sont un contrat. Logo officiel, logos championnats, drapeaux, logos circuits, fallbacks et fidélité cible >= 98 %.

## Données hybrides
Données sportives réalistes, identités synthétiques, secrets supprimés, intégrations neutralisées, aucun dump dans Git.

## Tests
Unitaires, intégration, API, Docker, UI, sécurité et non-régression. Une fusion dans main ne vaut pas validation utilisateur.

Chaque version candidate inclut un jeu de données de recette reproductible et idempotent couvrant les nouvelles fonctions et leurs principaux états limites. La livraison documente systématiquement la commande d'injection, les données attendues et les contrôles manuels associés. Ces données restent synthétiques, sans secret ni copie d'une base de production.

La validation utilisateur est explicite et consignée dans les fichiers d'état avec sa date et son périmètre. Une CI verte, un build réussi, une fusion ou un déploiement technique ne suffisent pas à déclarer un lot validé.

## Workflow Git
`main` reçoit uniquement des versions ayant déjà fait l'objet d'une validation utilisateur explicite ; `develop` sert à l'intégration ; `codex/*` aux travaux Codex ; `feature/*` aux fonctionnalités ; `release/*` à la préparation.
Fusionner une branche dans `main` ne constitue jamais, à lui seul, une validation utilisateur.

## État courant

Le Handbook ne duplique plus l'état opérationnel du projet. Lire exclusivement `docs/handoff/PROGRESS.json` pour connaître le lot/gate courant, les validations, les autorisations, les interdictions, les SHA de preuve et la prochaine action.

Les validations devenues des règles ou décisions permanentes restent documentées dans les ADR et les sections thématiques du Handbook ; leur présence ici ne doit pas être interprétée comme un suivi d'avancement concurrent.

## Règles Codex
Avant toute modification : lire ce Handbook, `CODEX.md`, `docs/handoff/PROGRESS.json`, tous les ADR du Handbook applicables et les spécifications du lot dans `docs/handoff/`. `PROJECT_STATUS.md`, `PROJECT-STATUS.json` et `NEXT_STEPS.md` sont des pointeurs de compatibilité et ne sont pas des sources d'état.

# Sécurité HTTP transversale

Toute requête HTTP sortante vers un fournisseur est refusée par défaut et n'est autorisée que si l'URL finale respecte une allowlist HTTPS explicite par fournisseur (schémas, hôtes et ports). Les redirections sont désactivées ou revalidées à chaque saut avec un nombre maximal borné ; aucune URL utilisateur arbitraire n'est suivie.

Les résolutions DNS sont contrôlées contre les destinations privées, loopback, link-local et réservées lorsque la politique fournisseur ne les autorise pas explicitement. Les connexions ont des timeouts bornés, des tailles de réponse maximales et une lecture streaming bornée. Les erreurs et journaux ne doivent jamais exposer secret, token, clé API, Authorization header ni contenu sensible de réponse.

Voir `docs/handbook/architecture/ADR-0016-PROVIDER-HTTP-SECURITY.md`.