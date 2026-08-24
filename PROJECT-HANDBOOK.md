# Motorsports Events Server — Project Handbook
## Version 1.38

Ce document est la source de vérité permanente du projet.

## Hiérarchie documentaire

- `PROJECT-HANDBOOK.md` et `docs/handbook/` portent les règles permanentes ;
- `docs/handoff/` porte le périmètre, l'avancement et les critères du lot courant sans pouvoir contredire le Handbook ;
- `docs/handover/` et la documentation historique restent conservés comme preuves et contexte des lots terminés ;
- `PROJECT-STATUS.json` distingue l'état validé de l'état en développement ;
- `docs/handoff/PROGRESS.json` est le suivi canonique du lot courant.

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

## État
Le Lot 5.4 et son scheduler persistant décrit par l'ADR-0015 sont validés par le mainteneur. La consolidation sécurité pré‑5.5 décrite par l'ADR-0016 a été auditée, corrigée et **validée explicitement par le mainteneur le 2026-08-14**.

Le Concept et l'Acceptance du Lot **5.5 — Quotas et cadence** ont été audités contre les invariants 5.4 et la baseline sécurité, corrigés puis validés par le mainteneur. Son implémentation a ensuite été auditée, les constats P1/P2/P3 ont été clos et le ré-audit final a réussi. Le **Lot 5.5 est validé par le mainteneur depuis le 2026-08-14**. Les preuves sont consignées dans `docs/handoff/LOT-5.5-MAINTAINER-VALIDATION.md` et la décision permanente dans `docs/handbook/architecture/ADR-0018-LOT-5.5-MAINTAINER-VALIDATION.md`.

Le Concept, le contrat UI et l'Acceptance du **Lot 5.6 — Acquisition fournisseur durable** ont été formalisés, audités contre 5.4/5.5, la baseline sécurité et la frontière 5.7, puis consolidés après fermeture des constats. Après le PASS final de 5.6-I, le mainteneur a **globalement validé le Lot 5.6 le 2026-08-21**.

`authorized_sub_lot = 5.7-P` autorise la tranche verticale de normalisation Production Preview depuis le 2026-08-21. Sa conception technique, son Acceptance PP-T01 à PP-T42 et ses six gates A→F sont validés par le mainteneur. 5.7-P-A/B sont validés depuis le 2026-08-22 ; la correction additive d'historique public de 5.7-P-C est revalidée mainteneur et 5.7-P-D est validé mainteneur avec preuve VPS au SHA `90e7f7cf5bd975aeb7610c3f98d1dbef0f323b96`. L’état public C associe état courant, versions canoniques immuables, révision et journal dans une transaction ; D reconstruit les snapshots historiques et fonde la rétention sur la frontière réelle. L’audit VPS du 2026-08-24 a rouvert la validation de 5.7-P-E après détection d’une collision d’enregistrement des routes V1 définitives ; la correction d’intégration est terminée mais exige une revalidation mainteneur et VPS. Ses clés client restent distinctes de l’admin et stockées uniquement sous forme de digest HMAC avec pepper hors base. L’activation Preview Production reste désactivée par défaut et aucun client externe n’est onboardé. **5.7-P-F, le Lot 5.7 complet, les Lots 5.8+ et le merge main restent non autorisés**. Voir ADR-0021 et ADR-0022.

Lots 4.1, 4.2 et 4.3 validés par l'utilisateur. Le Lot 4.3 combine les preuves VPS isolées des migrations, API, corrections et contrôles visuels avec la recette Windows complète réussie le 2026-08-11 (qualité, données synthétiques et 11 scénarios Chromium). Il attend sa fusion contrôlée dans `main` ; cette fusion ne constitue pas elle-même la validation, déjà acquise explicitement.

## Règles Codex
Avant toute modification : lire ce Handbook, `CODEX.md`, `PROJECT-STATUS.json`, `docs/handoff/PROGRESS.json`, tous les ADR du Handbook et les spécifications du lot dans `docs/handoff/`.

# Sécurité HTTP transversale

La frontière HTTP applique les règles permanentes de l’ADR-0016 : confiance proxy fermée par défaut et explicitement bornée par CIDR, corps de requête limité, headers de sécurité, redaction des secrets, et sorties fournisseur HTTPS limitées à une allowlist avec timeout et streaming borné.

Une API fournisseur qui impose un secret dans le chemin ou les paramètres
d’URL ne peut normalement pas être utilisée sous cette forme. L’unique
exception approuvée est la clé gratuite TheSportsDB dans le segment imposé de
l’API v1. Elle n’autorise ni secret en query string, ni URL user/password, ni
fuite de l’URL credentialisée dans les logs, erreurs, audits, traces, données
persistées ou surfaces retournées. Voir ADR-0020.

Les projections publiques sont explicites et séparées des projections administratives. Un championnat désactivé est absent des API publiques sans suppression de ses données. Nginx protège l’ACP par une CSP alignée sur l’origine API du build ; la terminaison TLS de production reste propriétaire de HSTS.
