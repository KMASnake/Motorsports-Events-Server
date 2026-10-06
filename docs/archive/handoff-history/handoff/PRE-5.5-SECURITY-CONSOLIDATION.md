# Consolidation sécurité pré‑Lot 5.5

Statut : **validée par le mainteneur le 2026-08-14**  
Périmètre : Lots 1 à 5.4, sans fonctionnalité Lot 5.5  
Date : 2026-08-14

## Méthode et inventaire

L’audit a couvert les routes Fastify, authentification HMAC et humaine, CSRF,
cookies, CORS, reverse proxy, HTTP sortant, secrets fournisseurs, audit, SQL,
validation Zod, rendu React, URL de logos, migrations, scheduler, Docker,
ignore files et dépendances. Les recherches statiques ont porté sur les
exécutions de commandes, injections HTML, accès réseau, secrets, SQL dynamique,
uploads, paths et headers. Aucun appel fournisseur réel n’a été effectué.

## Findings

| ID | Niveau | Constat et impact | Traitement | Test / statut |
|---|---|---|---|---|
| SEC-01 | P1 | `TRUST_PROXY=true` faisait confiance à toute chaîne X-Forwarded et fragilisait l’anti-bruteforce par IP. | Remplacement par `TRUST_PROXY_CIDRS`, fermé par défaut, refus de `true`/`*`. | spoof proxy testé — corrigé |
| SEC-02 | P1 | Le logger Fastify n’expurgeait pas explicitement Authorization, Cookie, Set-Cookie, x-api-key et mots de passe. | Configuration Pino centralisée avec redaction. | configuration et sentinelles testées — corrigé |
| SEC-03 | P1 | Le nettoyage de l’audit ne reconnaissait pas `api_key`, `api-key` et `master_key`. | Expression sensible étendue récursivement. | sentinelles imbriquées — corrigé |
| SEC-04 | P2 | Une réponse fournisseur chunked était entièrement bufferisée avant contrôle de taille. | Lecture streaming interrompue dès dépassement. | annulation du stream testée — corrigé |
| SEC-05 | P2 | Headers de sécurité et limite globale de corps non garantis dans Fastify. | CSP restrictive, nosniff, frame deny, referrer/permissions policy, HSTS production, corps 1 Mio. | headers et 413 testés — corrigé |
| SEC-06 | P2 | Défense SSRF répartie et incomplète pour IP privées, credentials URL et type MIME. | Contrôle central exact du host, HTTPS, réseaux privés, credentials, redirect error, JSON et timeout. | localhost/metadata/hosts trompeurs/content-type/timeout — corrigé |
| SEC-07 | P2 | Le schéma championnat acceptait des propriétés inconnues et des protocoles de logo non HTTP. | Schéma strict, URL `http`/`https` uniquement. | typecheck et tests globaux — corrigé |
| SEC-08 | P2 | Contexte Docker pouvait inclure `.env`, Git et artefacts ; API exécutée root. | `.dockerignore` et utilisateur `node` dans l’image API. | build requis — corrigé |
| SEC-09 | P3 | Le blocage vise les IP littérales ; une résolution DNS hostile pourrait évoluer vers une IP privée. | Risque accepté : hosts fixes des adaptateurs, aucune URL arbitraire ; resolver réseau différé. | documenté |
| SEC-10 | P3 | Les lectures publiques coûteuses n’ont pas de rate limit global. | Accepté avant 5.5 : login déjà borné, mutations admin protégées. | documenté |
| SEC-11 | P1 | Les lectures publiques des championnats exposaient les lignes désactivées et une projection `c.*`. | Projection publique explicite et filtre `active=true` obligatoires ; lectures administratives distinctes. | tests unitaires et recette PostgreSQL/API — corrigé |
| SEC-12 | P1 | Les headers Fastify ne protégeaient pas l’ACP statique servi par Nginx. | Headers Nginx réels et CSP construite avec l’origine API configurée ; cache HTML et assets conservés séparément. | conteneur Nginx et Chromium — corrigé |
| SEC-13 | P2 | L’absence de fuite du JSON public n’était pas vérifiée transversalement. | Parcours récursif des réponses championnats, événements, catalogues et sessions contre une liste de clés interdites. | 8 tests dédiés — corrigé |
| SEC-14 | P2 | Certains paramètres UUID pouvaient atteindre PostgreSQL sans validation uniforme. | Validation commune 400/404 sur les routes dont l’identité est réellement UUID ; compatibilité texte conservée pour Events/Sessions historiques. | quatre charges invalides avant DB — corrigé |
| SEC-15 | P2 | Des mutations historiques auditaient après commit via `onSend`. | Championnats, événements et corrections migrés vers mutation + audit transactionnels ; Sessions déjà atomiques ; marquage anti-double audit. | panne d’audit injectée, mutation rollbackée — corrigé |

Aucun P0 n’a été trouvé. Aucun upload binaire de logo n’existe dans le socle
Node : seul un champ URL est présent et il est désormais limité à HTTP(S).

## Garanties vérifiées

- Toutes les routes `/api/v1/admin/**` passent par le hook global ; les mutations historiques `/api/v1/championships` sont également protégées.
- Les mutations par session humaine exigent Origin exact, token CSRF signé et comparaison constante ; un Bearer technique admin reste indépendant du CSRF.
- HMAC SHA-256, payload strict, expiration et rôle admin restent obligatoires.
- Sessions aléatoires, expirations idle/absolue, logout et révocation restent couverts. Les cookies `__Host-*` de production sont Secure, sans Domain.
- CORS reste limité à `ADMIN_WEB_ORIGIN`, avec credentials.
- AES-256-GCM, nonce 12 octets, tag, AAD, version de clé, rotation et absence de fallback plaintext sont couverts.
- Les requêtes SQL utilisent des valeurs paramétrées ; les rares identifiants dynamiques proviennent d’allowlists internes. Aucun étalement direct de body dans les écritures n’a été trouvé.
- React échappe les textes fournisseurs et aucun `dangerouslySetInnerHTML` n’existe. L’API publique ne publie pas les secrets, curseurs, leases ou audits.
- Le scheduler conserve leases, fencing, pool global/fournisseur, stale commit, stale fail et stale discovery. Sync-now reste un boost et ne contourne pas ces protections ; désactiver conserve les données.
- Les audits applicatifs sont append-only. Les mutations sensibles de championnats, événements, sessions et corrections écrivent désormais leur audit dans la transaction métier et empêchent le double audit `onSend`.

## Corrections après audit mainteneur

Les lectures publiques de championnats ne renvoient que les lignes actives et une projection métier explicite. L’ACP utilise les lectures `/api/v1/admin/championships`, qui conservent la visibilité des lignes inactives et des champs nécessaires à l’administration. Désactiver un championnat ne supprime ni Events, ni Sessions, ni mappings fournisseur, ni streams.

Le Web Nginx sert CSP, `nosniff`, `no-referrer`, protection de frame et Permissions-Policy. `connect-src` est produit à partir de `VITE_API_URL` au build sans secret. Le HTML reste `no-store`; les assets Vite hashés conservent leur cache immutable. HSTS reste la responsabilité de la terminaison TLS en production ; le conteneur HTTP interne ne l’émet pas.

La convention UUID est `400` pour un format invalide et `404` pour un UUID valide absent. Elle s’applique aux championnats et ressources fournisseur dont la colonne est UUID. Les identifiants Events, Sessions et Corrections issus du socle historique restent volontairement textuels et sont toujours transmis à PostgreSQL par paramètres, sans concaténation utilisateur.

## Validation exécutée

- `npm run lint` : OK
- `npm run typecheck` : OK
- `npm test` : 29 tests Web + 157 tests API, OK
- `npm run build` : Web, API et types, OK
- `npm run test:security` : 52 tests ciblés, OK
- `npm run test:web-security` : headers servis par le conteneur Nginx, OK
- `npm run test:public-security` : masquage, conservation et rollback réel PostgreSQL/API, OK
- `npm run test:security-visual` : login, tableau de bord, championnats et fournisseurs sur `http://127.0.0.1:3800`, 1 test Chromium, aucune violation CSP ni erreur après authentification, OK
- `npm run test:lot54` : recette PostgreSQL/Docker, 8 tests ciblés et invariants, OK
- `./scripts/validate-repository.sh` : 51 tests historiques, 33 réussis et 18 ignorés faute de dépendances optionnelles, OK
- `git diff --check` : OK
- `npm audit --audit-level=low` : 0 vulnérabilité
- `docker compose --project-name mse-pre55-final-build build api web` : deux images construites, OK

Tests uniquement sur fixtures, transport mocké et PostgreSQL Docker local : `REAL PROVIDER REQUESTS = 0`, `PROVIDER CREDITS CONSUMED = 0`.

## Validation mainteneur et gate

Audit mainteneur terminé et baseline sécurité pré-5.5 **validée le 2026-08-14**.

`security_consolidation_maintainer_validated = true`.

Cette validation lève uniquement le gate de consolidation sécurité. Elle n'autorise pas à elle seule l'implémentation 5.5 : l'autorisation 5.5 reste soumise à son Concept, son Acceptance, leur audit croisé et la mise à jour explicite de `authorized_sub_lot`.
