# ADR-0016 — Frontière de sécurité HTTP

Statut : implémenté et validé dans la baseline sécurité pré-5.5
Date : 2026-08-14

## Décision

L’API Fastify applique une limite globale de corps de 1 Mio, une politique
commune de headers de sécurité et une expurgation explicite des headers et
champs secrets dans Pino. Lorsqu’elle est publiée par la terminaison HTTPS de
production, elle peut émettre HSTS.

Le serveur Nginx de l’ACP applique indépendamment CSP, `nosniff`,
`no-referrer`, interdiction de frame et Permissions-Policy sur le document SPA
et les assets. La CSP n’emploie pas `unsafe-eval`; son `connect-src` inclut
uniquement l’origine API issue de `VITE_API_URL` au build. Le HTML est servi
avec `no-store`, tandis que les assets Vite hashés restent immutables.

Le Nginx applicatif écoute en HTTP derrière le reverse proxy et n’émet donc pas
HSTS. La couche qui termine réellement TLS et connaît le schéma public HTTPS
est seule responsable de ce header afin d’éviter une politique contradictoire.

La confiance envers les reverse proxies est fermée par défaut. Seules les
adresses et plages déclarées dans `TRUST_PROXY_CIDRS` sont acceptées ; `true`
et `*` sont refusés. Chaque déploiement doit déclarer son propre réseau réel.

Tout transport HTTP fournisseur doit fournir une allowlist exacte de noms
d’hôte. HTTPS est obligatoire hors tests, les credentials dans l’URL, les IP
locales/privées/link-local et les redirections sont refusés. Les réponses sont
lues en streaming avec une limite de 1 000 000 octets et un timeout de huit
secondes.

Une clé placée dans un segment de chemin ou un paramètre reste un credential
dans l’URL et est interdite. Si le fournisseur propose une version authentifiée
par header, l’adaptateur doit employer cette version. TheSportsDB v1 place la
clé dans le chemin ; les appels d’acquisition et de découverte utilisent donc
TheSportsDB v2 avec `X-API-KEY`, conformément à sa documentation officielle :
<https://www.thesportsdb.com/docs_api_guide>.

## Conséquences

- une adresse `X-Forwarded-For` n’est fiable qu’après passage par un proxy
  explicitement approuvé ;
- les réponses JSON chunked ne peuvent plus provoquer un buffering illimité ;
- les providers Internet restent limités à leurs hosts fixes ;
- TheSportsDB nécessite un accès v2 compatible avec l’authentification par
  header ; une configuration v1 historique est normalisée vers la frontière
  v2 avant tout appel ;
- une modification de l’origine API impose de reconstruire l’image Web afin
  que le bundle et `connect-src` restent alignés ;
- les headers Fastify ne sont jamais considérés comme une protection du
  document ACP : Nginx possède sa propre politique ;
- le DNS rebinding après résolution reste une défense en profondeur à étudier
  si des hosts configurables sont un jour autorisés.

## Compatibilité

Cette décision ne modifie aucune route ni représentation métier. Les
installations utilisant l’ancien booléen `TRUST_PROXY` doivent renseigner une
liste `TRUST_PROXY_CIDRS` adaptée à leur reverse proxy.
