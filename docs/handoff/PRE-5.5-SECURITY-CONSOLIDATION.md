# Consolidation sécurité pré‑Lot 5.5

Statut : implémentée, audit mainteneur requis  
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
| SEC-10 | P3 | Les lectures publiques coûteuses n’ont pas de rate limit global. | Accepté avant 5.5 : login déjà borné, mutations admin protégées, pas de moteur quota anticipé. | documenté |

Aucun P0 n’a été trouvé. Aucun upload binaire de logo n’existe dans le socle
Node : seul un champ URL est présent et il est désormais limité à HTTP(S).

## Garanties vérifiées

- Toutes les routes `/api/v1/admin/**` passent par le hook global ; les
  mutations historiques `/api/v1/championships` sont également protégées.
- Les mutations par session humaine exigent Origin exact, token CSRF signé et
  comparaison constante ; un Bearer technique admin reste indépendant du CSRF.
- HMAC SHA-256, payload strict, expiration et rôle admin restent obligatoires.
- Sessions aléatoires, expirations idle/absolue, logout et révocation restent
  couverts. Les cookies `__Host-*` de production sont Secure, sans Domain.
- CORS reste limité à `ADMIN_WEB_ORIGIN`, avec credentials.
- AES-256-GCM, nonce 12 octets, tag, AAD, version de clé, rotation et absence de
  fallback plaintext sont couverts.
- Les requêtes SQL utilisent des valeurs paramétrées ; les rares identifiants
  dynamiques proviennent d’allowlists internes. Aucun étalement direct de body
  dans les écritures n’a été trouvé.
- React échappe les textes fournisseurs et aucun `dangerouslySetInnerHTML`
  n’existe. L’API publique ne publie pas les secrets, curseurs, leases ou audits.
- Le scheduler conserve leases, fencing, pool global/fournisseur, stale commit,
  stale fail et stale discovery. Sync-now reste un boost et ne contourne pas ces
  protections ; désactiver conserve les données.
- Les audits applicatifs sont append-only ; mutations et audits atomiques
  existants restent inchangés.

## Validation exécutée

- `npm run lint` : OK
- `npm run typecheck` : OK
- `npm test` : 29 tests Web + 148 tests API, OK
- `npm run build` : Web, API et types, OK
- `npm run test:security` : 44 tests ciblés, OK
- `npm run test:lot54` : recette PostgreSQL/Docker, 8 tests ciblés et invariants, OK
- `./scripts/validate-repository.sh` : 51 tests historiques, 33 réussis et 18 ignorés faute de dépendances optionnelles, OK
- `git diff --check` : OK
- `npm audit --audit-level=low` : 0 vulnérabilité
- `docker compose --project-name mse-pre55-security build api web` : deux images construites, OK

Tests uniquement sur fixtures, transport mocké et PostgreSQL Docker local :
`REAL PROVIDER REQUESTS = 0`, `PROVIDER CREDITS CONSUMED = 0`.

## Limites et arrêt

La baseline n’est pas déclarée validée :
`security_consolidation_maintainer_validated = false`. Le Lot 5.5 reste
`NOT STARTED` et `NOT AUTHORIZED`. Prochaine action : audit mainteneur, puis STOP.
