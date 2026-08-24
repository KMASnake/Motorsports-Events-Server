# ADR-0022 — Sécurité client de la Preview 5.7-P-E

Date : 2026-08-24
Statut : accepté et validé par le mainteneur

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

## Validation mainteneur

Le mainteneur valide explicitement 5.7-P-E le 2026-08-24 au SHA
`bfe6d4818b105a08417e6c524084cae0a176690d`. La CI GitHub, la revue
sécurité/code, PP-T29 à PP-T35, les critères fonctionnels E applicables PP-105
à PP-135 et PP-180, E01-E18 et la migration 0028 fresh/down/up avec protection
du rollback peuplé sont PASS. Aucun appel fournisseur réel et aucun crédit
fournisseur n’ont été consommés.

Cette validation n’autorise ni 5.7-P-F, ni l’activation Preview en Production,
ni l’onboarding d’un client externe, ni le Lot 5.7 complet, ni 5.8+, ni le
merge vers `main`.
