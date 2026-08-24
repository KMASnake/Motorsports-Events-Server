# ADR-0022 — Sécurité client de la Preview 5.7-P-E

Date : 2026-08-24
Statut : implémenté, en attente de validation mainteneur

## Décision

La frontière cliente Preview utilise des clés Bearer machine-to-machine
distinctes de l’authentification administrative. Le secret complet est généré
aléatoirement et retourné une seule fois. PostgreSQL conserve uniquement un
préfixe de recherche borné et un digest HMAC-SHA-256 calculé avec un pepper
serveur indépendant de la base. Toute vérification de digest utilise une
comparaison constant-time, y compris pour un préfixe inconnu.

Les quatre scopes read sont distincts des entitlements championnat. Les droits
sont relus pour chaque requête et les cursors signés sont liés au client, jamais
à une clé physique. Les collections et `/changes` filtrent en SQL ; un filtre
explicitement interdit reçoit 403 et un UUID inaccessible 404.

Les limites par défaut sont 60 requêtes/minute et 10 000/jour UTC par client.
Les compteurs PostgreSQL sont atomiques. Une réponse 304 reste chargée et une
5xx rembourse la charge journalière. Les transitions client, clé, droits et
limites sont des opérations ACP protégées et auditées avec redaction du digest.

## Déploiement et frontière

La migration 0028 est additive et son DOWN refuse toute donnée client. Le
plugin D n’est enregistré derrière E que si `PREVIEW_API_ENABLED=true`; la
valeur par défaut reste `false`. Cette décision n’active donc pas la visibilité
Production, n’onboarde aucun client externe et n’autorise pas 5.7-P-F.
