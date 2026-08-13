# ADR-0016 — Frontière de sécurité HTTP

Statut : implémenté, en attente de validation mainteneur  
Date : 2026-08-14

## Décision

L’API applique une limite globale de corps de 1 Mio, une politique commune de
headers de sécurité et une expurgation explicite des headers et champs secrets
dans Pino. HSTS n’est émis qu’en production.

La confiance envers les reverse proxies est fermée par défaut. Seules les
adresses et plages déclarées dans `TRUST_PROXY_CIDRS` sont acceptées ; `true`
et `*` sont refusés. Chaque déploiement doit déclarer son propre réseau réel.

Tout transport HTTP fournisseur doit fournir une allowlist exacte de noms
d’hôte. HTTPS est obligatoire hors tests, les credentials dans l’URL, les IP
locales/privées/link-local et les redirections sont refusés. Les réponses sont
lues en streaming avec une limite de 1 000 000 octets et un timeout de huit
secondes.

## Conséquences

- une adresse `X-Forwarded-For` n’est fiable qu’après passage par un proxy
  explicitement approuvé ;
- les réponses JSON chunked ne peuvent plus provoquer un buffering illimité ;
- les providers Internet restent limités à leurs hosts fixes ;
- le DNS rebinding après résolution reste une défense en profondeur à étudier
  si des hosts configurables sont un jour autorisés.

## Compatibilité

Cette décision ne modifie aucune route ni représentation métier. Les
installations utilisant l’ancien booléen `TRUST_PROXY` doivent renseigner une
liste `TRUST_PROXY_CIDRS` adaptée à leur reverse proxy.
