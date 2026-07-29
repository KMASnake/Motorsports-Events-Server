# ADR 0013 — Endpoints d’observabilité

## Statut

Accepté.

## Décision

`/live` confirme que le processus répond. `/ready` exige une connexion
PostgreSQL fonctionnelle. `/metrics` utilise le format texte Prometheus et
expose uniquement l’état du processus, son uptime et des compteurs HTTP.

Les labels HTTP utilisent les routes déclarées, jamais l’URL brute, une clé,
un identifiant d’événement ou un paramètre utilisateur.

## Conséquences

- les sondes et collecteurs n’ont pas besoin d’une clé API ;
- aucune donnée métier ou secrète n’est exposée ;
- un échec PostgreSQL produit une readiness HTTP 503 ;
- le contrat `/api/v1` reste inchangé.
